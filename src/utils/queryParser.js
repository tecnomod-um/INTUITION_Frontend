import { capitalizeFirst, cleanString, getItemFromURI, addSpaceChars, removeSpaceChars } from "./stringFormatter.js";

const getOperatorString = (operator, type, value, varNodeData, isDefined) => {
    const valueString = isDefined ? `?${value}` : ['number', 'decimal', 'datetime'].includes(type) ? value : `"${value}"`;
    const operators = {
        '>': `?${varNodeData} > ${valueString}`,
        '<': `?${varNodeData} < ${valueString}`,
        '<=': `?${varNodeData} <= ${valueString}`,
        '>=': `?${varNodeData} >= ${valueString}`,
        '⊆': `REGEX(?${varNodeData}, ${valueString})`,
        '=': `?${varNodeData} = ${valueString}`,
    }
    return operators[operator] || operators['='];
}

// Add both general and instance variables defined in StartingVar
const defineProjectionVariables = (startingVar, isCount) => {
    let variables = '';
    let countVariables = '';

    Object.keys(startingVar).forEach(nodeId => {
        if (startingVar[nodeId].class || startingVar[nodeId].instance) {
            const baseVar = startingVar[nodeId].varID >= 0 ?
                capitalizeFirst(startingVar[nodeId].type) + '___' + startingVar[nodeId].varID :
                `List___${nodeId}`;
            const varUri = baseVar + '___URI';
            const varInstanceUri = baseVar + '___URI___instance';

            if (startingVar[nodeId].class) {
                variables += ` ?${varUri}`;
                countVariables += ` COUNT(DISTINCT ?${varUri}) AS ?${varUri}___count`;
            }
            if (startingVar[nodeId].instance) {
                variables += ` ?${varInstanceUri}`;
                countVariables += ` COUNT(DISTINCT ?${varInstanceUri}) AS ?${varInstanceUri}___count`;
            }
        }
    });
    return isCount ? countVariables : variables;
}

// Adds a graphs configuration to the query
const addGraphDefinitions = (graph, graphs, parsedQuery, isCount) => {
    // Graph components
    const nodes = graph.nodes;
    const edges = graph.edges;
    const bindings = graph.bindings;
    const filters = graph.filters;
    // Used to avoid repetitions
    const uniqueBindingsMap = new Map();
    graphs.forEach(graph => {
        graph.bindings.forEach(({ label, firstValue, secondValue }) => {
            if (!uniqueBindingsMap.has(label))
                uniqueBindingsMap.set(label, {});
            const properties = uniqueBindingsMap.get(label);
            [firstValue, secondValue].forEach(value => {
                if (value?.propertyUri) {
                    properties[value.propertyUri] = properties[value.propertyUri] || new Set();
                    if (value.nodeId !== undefined)
                        properties[value.propertyUri].add(value.nodeId);
                }
            });
        });
    });
    const allBindings = Array.from(uniqueBindingsMap.values());

    // Define unions present in the graph
    const unionPairs = edges.filter(edge => edge.data === "UNION").map(edge => ({ from: edge.from, to: edge.to }));
    // Track processed graph nodes to avoid duplication
    const processedNodes = new Set();
    Object.keys(nodes).forEach(nodeInList => {
        // If node represents a graph, build a UNION operation
        const currentNode = nodes[nodeInList];
        // Skip if the node has already been processed in UNIONS
        if (processedNodes.has(currentNode.id)) return;
        if (currentNode.shape === 'circle') {
            let isPartOfUnion = false;
            unionPairs.forEach(pair => {
                if (pair.from === currentNode.id || pair.to === currentNode.id) {
                    isPartOfUnion = true;
                    processedNodes.add(pair.from);
                    processedNodes.add(pair.to);
                    // Build UNION clause
                    parsedQuery.body += '{\n';
                    const firstUnionBlock = graphs.find(graph => graph.id === nodes.find(node => node.id === pair.from)?.data);
                    addGraphDefinitions(firstUnionBlock, graphs, parsedQuery, isCount);
                    parsedQuery.body += `} UNION {\n`;
                    const secondUnionBlock = graphs.find(graph => graph.id === nodes.find(node => node.id === pair.to)?.data);
                    addGraphDefinitions(secondUnionBlock, graphs, parsedQuery, isCount);
                    parsedQuery.body += `}\n`;
                }
            });
            // Current node is not part of any union pair, wrap it in brackets
            if (!isPartOfUnion) {
                parsedQuery.body += '{\n';
                addGraphDefinitions(graphs.find(graph => graph.id === currentNode.data), graphs, parsedQuery, isCount);
                parsedQuery.body += '}\n';
            }
            return;
        }
        // If node is a uri list it will be skipped
        if (currentNode.shape === 'box') return;
        // Regular nodes
        const nodeIsVar = currentNode.varID >= 0;
        const varNode = nodeIsVar ? currentNode.data : `<${currentNode.data}>`;
        // Detect both general and instance edges
        let hasClassVariable = !edges.some(edge => (edge.from === currentNode.id));
        let hasInstanceVariable = false;
        edges.filter(edge => edge.from === currentNode.id).forEach(edge => {
            hasClassVariable = hasClassVariable || !edge.isFromInstance;
            hasInstanceVariable = hasInstanceVariable || edge.isFromInstance;
        });
        // Apply class/graph restrictions
        let graph = '';
        if (hasClassVariable) {
            if (nodeIsVar && !['http://www.w3.org/2002/07/owl#Thing', 'Triplet'].includes(currentNode.class))
                parsedQuery.body += `${varNode} <http://www.w3.org/2000/01/rdf-schema#subClassOf> <${currentNode.class}> .\n`;
            else if (edges.some(edge => edge.from === currentNode.id)) {
                graph = `GRAPH <${currentNode.graph}> {\n`;
                parsedQuery.body += graph;
            }
        }
        // Apply instance restrictions
        if (hasInstanceVariable) {
            if (nodeIsVar && !['http://www.w3.org/2002/07/owl#Thing', 'Triplet'].includes(currentNode?.class))
                parsedQuery.body += `${varNode}___instance <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ${varNode} .\n${varNode} <http://www.w3.org/2000/01/rdf-schema#subClassOf> <${currentNode.class}> .\n`
            else if (edges.some(edge => edge.from === currentNode.id)) {
                graph = `GRAPH <${currentNode.graph}> {\n`;
                parsedQuery.body += graph;
                parsedQuery.body += `${varNode}___instance <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ${varNode}___class .\n${varNode}___class <http://www.w3.org/2000/01/rdf-schema#subClassOf> <http://www.w3.org/1999/02/22-rdf-syntax-ns#Statement> .\n`;
            }
        }
        // Build object properties
        edges.filter(edge => edge.from === currentNode.id).forEach(edge => {
            let optional = edge.isOptional ? `OPTIONAL { ` : ``;
            let transitive = edge.isTransitive ? `*` : ``;
            let targetNode = nodes.find(node => node.id === edge.to);
            let subject;
            let instance = edge.isFromInstance ? `___instance` : ``;
            if (targetNode.shape === 'box') {
                subject = `?List___${targetNode.id}___URI`;
                parsedQuery.body += `VALUES ${subject} { ${targetNode.data.map(item => `<${item}>`).join(' ')} }`;
            }
            else if (targetNode.varID >= 0)
                subject = targetNode.data;
            else
                subject = `<${targetNode.data}>`;
            parsedQuery.body += `${optional}${varNode}${instance} <${edge.data}>${transitive} ${subject} ${optional ? '}' : ''}.\n`;
        });
        // Build data properties
        Object.keys(currentNode.properties).forEach(property => {
            const show = currentNode.properties[property].show;
            const data = currentNode.properties[property].data;
            const uri = currentNode.properties[property].uri;

            const usedInBinding = allBindings.some(bindingObject =>
                Object.entries(bindingObject).some(([propertyUri, nodeIds]) =>
                    propertyUri === uri && nodeIds.has(currentNode.id)
                )
            );
            if (show || data || usedInBinding) {
                const varProperty = (!nodeIsVar)
                    ? cleanString(capitalizeFirst(removeSpaceChars(property)) + '___' + currentNode.label + '___' + currentNode.id)
                    : cleanString(capitalizeFirst(removeSpaceChars(property)) + '___' + currentNode.type.toUpperCase() + '___' + currentNode.varID);
                const uri = currentNode.properties[property].uri;
                const transitive = currentNode.properties[property].transitive ? `*` : ``;
                if (show)
                    parsedQuery.select += isCount ? ` COUNT(DISTINCT ?${varProperty}) AS ?${varProperty}___count` : ` ?${varProperty}`;
                // In versions before VIRTUOSO 8, a bug prevents declaring filters using vars declared with '=' inside UNIONS.
                if (data && currentNode.properties[property].operator === '=')
                    parsedQuery.body += `${varNode} <${uri}>${transitive} ${currentNode.properties[property].type === 'number' ? data : `"${data}"`} .\n`;
                else {
                    parsedQuery.body += `${varNode} <${uri}>${transitive} ?${varProperty} .\n`;
                    if (data) parsedQuery.body += `FILTER ( ${getOperatorString(currentNode.properties[property].operator, currentNode.properties[property].type, data, varProperty, false)} ) .\n`;
                }
            }
        });
        if (graph) parsedQuery.body += `}\n`;
    });
    // Build binding variables
    const createBindingElement = (value) => {
        if (value.isCustom) return value.value;
        const valueLabel = value.isFromNode ? (value.isVar ? value.label : value.label + '___' + value.nodeId) : value.label;
        return `?${cleanString(capitalizeFirst(removeSpaceChars(valueLabel)))}`;
    };
    bindings.forEach(binding => {
        const formattedFirstValue = createBindingElement(binding.firstValue);
        const formattedSecondValue = createBindingElement(binding.secondValue);
        let expression;
        if (binding.operator === '⊆')
            expression = `CONTAINS(${formattedFirstValue}, ${formattedSecondValue})`;
        else if (binding.isAbsolute)
            expression = `ABS(${formattedFirstValue} ${binding.operator} ${formattedSecondValue})`;
        else
            expression = `${formattedFirstValue} ${binding.operator} ${formattedSecondValue}`;

        const bindingName = getItemFromURI(cleanString(capitalizeFirst(removeSpaceChars(binding.label))));
        if (binding.showInResults)
            parsedQuery.select += isCount ? ` COUNT(DISTINCT ?${bindingName}) AS ?${bindingName}___count` : ` ?${bindingName}`;
        parsedQuery.body += `BIND (${expression} AS ?${bindingName})\n`;
    });

    // Build filters
    filters.forEach(filter => {
        const firstElement = cleanString(capitalizeFirst(removeSpaceChars(filter.firstValue.label)));
        const secondElement = cleanString(capitalizeFirst(removeSpaceChars(filter.secondValue.label)));
        const secondValueType = filter.secondValue.custom && (filter.comparator === '⊆' || filter.comparator === '=') ? 'text' : 'number';
        parsedQuery.body += `FILTER ( ${getOperatorString(filter.comparator, secondValueType, secondElement, firstElement, !filter.secondValue.custom)} ) .\n`;
    });
}

// Parses a SPARQL query from the apps used structures
export const parseQuery = (graphs, activeGraphId, startingVar, isDistinct, isCount) => {
    const activeGraph = graphs.find(graph => graph.id === activeGraphId);
    let parsedQuery = {
        select: 'SELECT',
        body: 'WHERE {\n'
    };

    let variablesString = defineProjectionVariables(startingVar, isCount);

    if (isCount)
        parsedQuery.select += ` ${variablesString}`;
    else {
        if (isDistinct) parsedQuery.select += ' DISTINCT';
        parsedQuery.select += variablesString;
    }

    addGraphDefinitions(activeGraph, graphs, parsedQuery, isCount);
    parsedQuery.body += '}';
    console.log(parsedQuery.select + '\n' + parsedQuery.body + '\n');
    return parsedQuery.select + '\n' + parsedQuery.body + '\n';
};

export const parseResponse = (response) => {
    const resultURIAndLabels = {};
    const resultOther = {};

    response.data.results.bindings.forEach((binding) => {
        const keysInThisBinding = new Set();
        Object.entries(binding).forEach(([key, value]) => {
            // Establish query columns
            const keyWithSpaces = addSpaceChars(key);
            keysInThisBinding.add(keyWithSpaces);
            if (value.type === 'uri') {
                const labelFieldName = keyWithSpaces.replace(/URI/g, 'Label');
                keysInThisBinding.add(labelFieldName);
                if (!resultURIAndLabels[labelFieldName]) {
                    resultURIAndLabels[labelFieldName] = [];
                }
                resultURIAndLabels[labelFieldName].push(value.label);
                if (!resultURIAndLabels[keyWithSpaces])
                    resultURIAndLabels[keyWithSpaces] = [];
                resultURIAndLabels[keyWithSpaces].push(value.value);
            } else {
                if (!resultOther[keyWithSpaces])
                    resultOther[keyWithSpaces] = [];
                resultOther[keyWithSpaces].push(value.value);
            }
        });
        // Ensure all arrays have the same length by filling missing values with ""
        [...Object.keys(resultURIAndLabels), ...Object.keys(resultOther)].forEach(key => {
            if (!keysInThisBinding.has(key)) {
                if (resultURIAndLabels[key]) {
                    resultURIAndLabels[key].push("");
                } else {
                    resultOther[key].push("");
                }
            }
        });
    });
    const result = { ...resultURIAndLabels, ...resultOther };
    return result;
}
