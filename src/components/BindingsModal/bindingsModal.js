import React, { useState, useEffect, useCallback, useMemo } from "react";
import { capitalizeFirst } from "../../utils/stringFormatter.js";
import { getOperatorTooltip } from "../../utils/typeChecker.js";
import ModalWrapper from '../ModalWrapper/modalWrapper';
import Checkbox from "../Checkbox/checkbox.js";
import BindingModalStyles from "./bindingsModal.module.css";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from '@mui/icons-material/RemoveCircleOutline';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

// Modal used in binding definitions
function BindingsModal({ allNodes, allBindings, bindings, isBindingsOpen, setBindingsOpen, setBindings }) {
    // Binding definitions
    const [tempBindings, setTempBindings] = useState([]);
    const [activeBindings, setActiveBindings] = useState([]);
    // Binding builder inputs
    const [operator, setOperator] = useState('==');
    const [firstCustomValue, setFirstCustomValue] = useState(0);
    const [secondCustomValue, setSecondCustomValue] = useState(0);
    const [firstBuilderValue, setFirstBuilderValue] = useState({ custom: false, type: 'number' });
    const [secondBuilderValue, setSecondBuilderValue] = useState({ custom: false, type: 'number' });
    const [bindingName, setBindingName] = useState("");
    const [isAbsolute, setIsAbsolute] = useState(false);
    const [showInResults, setShowInResults] = useState(false);
    // Modal element configurations
    const [error, showError] = useState(false);
    const [showBindingBuilder, setShowBindingBuilder] = useState(bindings.length === 0);
    const [showFirstCustomInput, setFirstCustomInput] = useState(false);
    const [showSecondCustomInput, setSecondCustomInput] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(window.innerWidth);

    const operatorLists = useMemo(() => ({
        number: ['+', '-', '*', '/', '==', '>', '<', '>=', '<=', '='],
        decimal: ['+', '-', '*', '/', '==', '>', '<', '>=', '<=', '='],
        text: ['==', '⊆', '='],
        boolean: ['==', '!=', '='],
        datetime: ['==', '<', '<=', '>=', '>', '='],
        binary: ['==', '!=', '='],
        link: ['==', '!=', '⊆', '='],
        uri: ['==', '!=', '⊆', '='],
        select: ['==', '='],
        custom: ['==', '+', '-', '*', '/', '>', '<', '>=', '<=', '!=', '⊆', '=']
    }), []);

    // Gets all elements that could be useful for a binding definition, including other bindings
    const getAvailableProperties = useCallback(() => {
        const nodeValues = (() => {
            const labelMap = new Map();
            allNodes.flatMap(node =>
                Object.entries(node.properties)
                    .filter(([_, property]) => property.show || property.data || property.as)
                    .forEach(([key, property]) => {
                        const label = capitalizeFirst(property.as || `${key} ${node.label}`);
                        if (!labelMap.has(label)) {
                            labelMap.set(label, {
                                label,
                                key,
                                nodeLabel: node.label,
                                isVar: node.varID >= 0,
                                isFromNode: true,
                                nodeId: node.ids,
                                propertyUri: property.uri,
                                type: property.type,
                                value: JSON.stringify({ label, key, nodeLabel: node.label, isVar: node.varID >= 0, isFromNode: true, nodeId: node.ids, propertyUri: property.uri, type: property.type })
                            });
                        }
                    })
            );
            return Array.from(labelMap.values());
        })();

        const combinedBindings = [...allBindings, ...tempBindings].reduce((acc, binding) => {
            if (!acc.some(accBinding => accBinding.label === binding.label)) {
                acc.push({
                    label: binding.label,
                    isFromNode: false,
                    bindingId: binding.id,
                    type: 'custom',
                    value: JSON.stringify({ label: binding.label, isFromNode: false, bindingId: binding.id, type: 'custom' })
                });
            }
            return acc;
        }, []).filter(binding => !usesRestrictedOperator(binding));

        return [...nodeValues, ...combinedBindings];
    }, [allNodes, allBindings, tempBindings]);

    // Resets select values
    const setDefaultValuesToFirstOption = useCallback((setSelectedValue) => {
        const numericProperties = getAvailableProperties(allNodes, tempBindings);
        setSelectedValue(numericProperties[0]);
    }, [allNodes, tempBindings, getAvailableProperties]);

    // Recursively removes a binding tree
    const removeBindingAndDependencies = useCallback((bindingId, bindingArray, tempBindingArray) => {
        if (firstBuilderValue && firstBuilderValue.bindingId === bindingId)
            setDefaultValuesToFirstOption(setFirstBuilderValue);
        if (secondBuilderValue && secondBuilderValue.bindingId === bindingId)
            setDefaultValuesToFirstOption(setSecondBuilderValue);
        let updatedBindings = bindingArray.filter(b => b.id !== bindingId);
        let updatedTempBindings = tempBindingArray.filter(b => b.id !== bindingId);
        const dependentBindings = [...updatedBindings, ...updatedTempBindings].filter(binding =>
            binding.firstValue.bindingId === bindingId || binding.secondValue.bindingId === bindingId);
        for (const dependentBinding of dependentBindings)
            [updatedBindings, updatedTempBindings] = removeBindingAndDependencies(dependentBinding.id, updatedBindings, updatedTempBindings);
        return [updatedBindings, updatedTempBindings];
    }, [firstBuilderValue, secondBuilderValue, setDefaultValuesToFirstOption]);

    // Remove and update bindings
    const handleRemoveVariable = useCallback((bindingId) => {
        let [updatedBindings, updatedTempBindings] = removeBindingAndDependencies(bindingId, bindings, tempBindings);
        const updatedActiveBindings = [...updatedBindings, ...updatedTempBindings].map(b => b.id);
        setActiveBindings(updatedActiveBindings);
        setTimeout(() => {
            setBindings(updatedBindings);
            setTempBindings(updatedTempBindings);
        }, 500);
    }, [bindings, tempBindings, setBindings, removeBindingAndDependencies]);

    // Initialize the firstBuilderValue and secondBuilderValue
    const initializeBuilderValues = useCallback(() => {
        const availableProperties = getAvailableProperties();
        if (availableProperties.length > 0) {
            const firstOption = JSON.parse(availableProperties[0].value);
            setFirstBuilderValue(firstOption);
            setSecondBuilderValue(firstOption);
        }
    }, [getAvailableProperties]);

    useEffect(() => {
        initializeBuilderValues();
    }, [initializeBuilderValues]);

    // Detects the viewport size for element configs
    useEffect(() => {
        const handleResize = () => {
            setViewportWidth(window.innerWidth);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Updates bindings on node removal
    useEffect(() => {
        const currentNodesIds = new Set(allNodes.flatMap(node => node.ids));
        const updatedBindings = bindings.map(binding => {
            const updateNodeIds = (value) => {
                if (value.isFromNode)
                    value.nodeId = value.nodeId.filter(id => currentNodesIds.has(id));
            };
            updateNodeIds(binding.firstValue);
            updateNodeIds(binding.secondValue);
            return binding;
        });

        const bindingsToRemove = updatedBindings.filter(binding => {
            const isFirstValueInvalid = binding.firstValue.isFromNode && (!binding.firstValue.nodeId || binding.firstValue.nodeId.length === 0);
            const isSecondValueInvalid = binding.secondValue.isFromNode && (!binding.secondValue.nodeId || binding.secondValue.nodeId.length === 0);
            return isFirstValueInvalid && isSecondValueInvalid; // Both values are invalid
        });

        bindingsToRemove.forEach(binding => handleRemoveVariable(binding.id));
        if (bindingsToRemove.length > 0) {
            const remainingBindings = updatedBindings.filter(binding => !bindingsToRemove.includes(binding));
            setBindings(remainingBindings);
        }
    }, [allNodes, bindings, handleRemoveVariable, setBindings]);

    // Sets up the builder visibility
    useEffect(() => {
        if (!isBindingsOpen) setShowBindingBuilder(bindings.length === 0);
    }, [isBindingsOpen, bindings]);

    // Fading in effect
    useEffect(() => {
        const currentBindingIds = [...bindings, ...tempBindings].map(item => item.id);
        setActiveBindings(currentBindingIds);
    }, [bindings, tempBindings]);

    // Sets up the selects' default option so thats visually coherent
    useEffect(() => {
        if (!firstBuilderValue) setDefaultValuesToFirstOption(setFirstBuilderValue);
        if (!secondBuilderValue) setDefaultValuesToFirstOption(setSecondBuilderValue);
    }, [firstBuilderValue, secondBuilderValue, setDefaultValuesToFirstOption]);

    const makeItem = (element) => {
        return <option key={element.label} value={element.value}>{element.label}</option>;
    }

    const usesRestrictedOperator = (binding) => {
        return ['>', '<'].includes(binding.operator);
    }

    // Creates the value's structure from the element it refers to
    const findValueInfo = (value) => {
        if (value.isFromNode) {
            return {
                label: value.label,
                key: value.key,
                nodeLabel: value.nodeLabel,
                isVar: value.isVar,
                isFromNode: true,
                nodeId: value.nodeId,
                propertyUri: value.propertyUri,
                type: value.type
            };
        }
        const foundBinding = [...allBindings, ...tempBindings].find(binding => binding.id === value.bindingId);
        if (foundBinding) {
            return {
                label: foundBinding.label,
                isFromNode: false,
                isCustom: false,
                bindingId: foundBinding.id,
                type: 'custom'
            };
        }
    }

    const addBinding = () => {
        showError(false);
        if ((!bindingName.trim()) || ([...bindings, ...tempBindings].some(b => b.label === bindingName))) {
            showError(true);
            return;
        }
        const firstValueInfo = showFirstCustomInput ? { isFromNode: false, isCustom: true, value: firstCustomValue, label: `Custom value (${firstCustomValue})` } : findValueInfo(firstBuilderValue);
        const secondValueInfo = showSecondCustomInput ? { isFromNode: false, isCustom: true, value: secondCustomValue, label: `Custom value (${secondCustomValue})` } : findValueInfo(secondBuilderValue);
        const newBinding = {
            id: Date.now(),
            label: bindingName,
            operator: operator,
            firstValue: firstValueInfo,
            secondValue: secondValueInfo,
            showInResults: showInResults,
            isAbsolute: isAbsolute
        }
        setTempBindings(prev => [...prev, newBinding]);
    }

    const isValueInTempBindings = (value) => {
        return tempBindings.some(binding => binding.id === (value?.bindingId || -1));
    }

    const handleClose = () => {
        if (isValueInTempBindings(firstBuilderValue))
            setDefaultValuesToFirstOption(setFirstBuilderValue);
        if (isValueInTempBindings(secondBuilderValue))
            setDefaultValuesToFirstOption(setSecondBuilderValue);
        setTempBindings([]);
        setBindingsOpen(false);
    }

    const handleSubmit = () => {
        setBindings([...bindings, ...tempBindings]);
        handleClose();
    }

    const handleOptionChange = (event, setValue, setCustomInput) => {
        const value = JSON.parse(event.target.options[event.target.selectedIndex].value);

        if (value.custom) {
            setCustomInput(true);
            setValue({ custom: true, type: 'custom' });
        } else {
            setCustomInput(false);
            setValue(value);
        }
        // Keep current operator if valid
        const validOperators = value.custom ? operatorLists.custom : operatorLists[value.type];
        if (!validOperators || !validOperators.includes(operator))
            setOperator(validOperators[0]);
    }

    const handleOperatorChange = (e) => {
        setOperator(e.target.value);
    }

    const toggleBindingBuilderVisibility = () => {
        setShowBindingBuilder(!showBindingBuilder);
    }

    // Adapts the element positioning for the different options inside bindingBuilder
    const getGridTemplate = (viewportWidth, showFirstCustomInput, showSecondCustomInput, operator) => {
        const isEqualsOperator = operator === '=';
        let baseTemplate, middleTemplate, endTemplate;

        if (isEqualsOperator) {
            if (viewportWidth <= 768) {
                baseTemplate = showSecondCustomInput ? "120px 30px" : "150px 30px";
                middleTemplate = "120px 20px";
                endTemplate = "30px 30px 1fr";
            } else {
                baseTemplate = "0.5fr 150px";
                middleTemplate = showSecondCustomInput ? "0.5fr 120px 20px" : "0.5fr 150px";
                endTemplate = "0.5fr 0.5fr 1fr";
            }
        } else {
            baseTemplate = viewportWidth <= 768 ? "100px 30px" : "0.8fr 100px 1fr";
            endTemplate = viewportWidth <= 768 ? "30px 30px 60px" : "1fr 1fr";

            if (showFirstCustomInput && showSecondCustomInput)
                middleTemplate = viewportWidth <= 768 ? "120px 20px 42px 120px 20px" : "120px 20px 42px 120px 20px 1fr";
            else if (showFirstCustomInput)
                middleTemplate = viewportWidth <= 768 ? "120px 20px 42px 150px" : "120px 20px 42px 150px 1fr";
            else if (showSecondCustomInput)
                middleTemplate = viewportWidth <= 768 ? "150px 42px 120px 20px" : "150px 42px 120px 20px 1fr";
            else
                middleTemplate = viewportWidth <= 768 ? "150px 42px 150px" : "150px 42px 150px 1fr";
        }
        return `${baseTemplate} ${middleTemplate} ${endTemplate}`;
    }

    // Binding builder interface definition
    function bindingBuilder() {
        const numericProperties = getAvailableProperties(allNodes, tempBindings);
        const hasOptions = numericProperties && numericProperties.length > 0;
        const optionSet = hasOptions ? [
            ...numericProperties.map((item) => makeItem(item)),
            <option key="custom-value" value={JSON.stringify({ custom: true })}>
                Custom value
            </option>
        ] : [<option key="no-options" value="">{`No options available`}</option>];
        const isEqualsOperator = operator === '=';
        return (
            <section aria-labelledby="binding-builder-title" className={BindingModalStyles.bindingBuilder}>
                <h3 id="binding-builder-title" className="visually-hidden">Binding Builder</h3>
                <div className={BindingModalStyles.fieldContainer} style={{ gridTemplateColumns: getGridTemplate(viewportWidth, showFirstCustomInput, showSecondCustomInput, operator) }}>
                    <label className={BindingModalStyles.labelVarname}>Variable</label>
                    <span className={BindingModalStyles.inputWrapper}>
                        <input
                            className={BindingModalStyles.input}
                            type="text"
                            value={bindingName}
                            disabled={!hasOptions}
                            onChange={e => setBindingName(e.target.value)}
                            aria-label="Variable Input" />
                        {error && <CloseIcon aria-label="Input error" aria-live="polite" className={BindingModalStyles.errorIcon} />}
                    </span>
                    {!isEqualsOperator && (
                        <label className={BindingModalStyles.labelEquals}>{viewportWidth <= 768 ? ":" : "results from"}</label>
                    )}
                    {
                        !isEqualsOperator && (
                            <>
                                {showFirstCustomInput && (
                                    <input
                                        type="text"
                                        aria-label="First custom value"
                                        value={firstCustomValue}
                                        onChange={(e) => e.target.value ? setFirstCustomValue(parseInt(e.target.value, 10)) : setFirstCustomValue(0)}
                                        className={BindingModalStyles.input}
                                    />
                                )}
                                <select
                                    className={BindingModalStyles.input}
                                    aria-label="First value"
                                    value={showFirstCustomInput ? JSON.stringify({ custom: true }) : JSON.stringify(firstBuilderValue)}
                                    onChange={(e) => handleOptionChange(e, setFirstBuilderValue, setFirstCustomInput)}
                                    disabled={!hasOptions}>
                                    {optionSet}
                                </select>
                            </>
                        )
                    }
                    <select
                        title={getOperatorTooltip(operator)}
                        aria-label="Operator Selector"
                        className={BindingModalStyles.operatorSelector}
                        value={operator}
                        onChange={handleOperatorChange}
                        disabled={!hasOptions}>
                        {
                            firstBuilderValue.custom ?
                                operatorLists.custom.map(option => (
                                    <option key={option} value={option}>{option}</option>)) :
                                (operatorLists[firstBuilderValue.type] || []).map(option => (
                                    <option key={option} value={option}>{option}</option>))
                        }
                    </select>
                    {showSecondCustomInput && (
                        <input
                            type="text"
                            aria-label="Second custom value"
                            value={secondCustomValue}
                            onChange={(e) => e.target.value ? setSecondCustomValue(parseInt(e.target.value, 10)) : setSecondCustomValue(0)}
                            className={BindingModalStyles.input}
                        />
                    )}
                    <select
                        className={BindingModalStyles.input}
                        aria-label="Second value"
                        value={showSecondCustomInput ? JSON.stringify({ custom: true }) : JSON.stringify(secondBuilderValue)}
                        onChange={(e) => handleOptionChange(e, setSecondBuilderValue, setSecondCustomInput)}
                        disabled={!hasOptions}
                    >
                        {optionSet}
                    </select>
                    <Checkbox
                        label="Show in results"
                        labelClassName={BindingModalStyles.labelCheckbox}
                        checked={showInResults}
                        aria-label="Show in Results"
                        disabled={!hasOptions}
                        onChange={(e) => setShowInResults(e.target.checked)}
                    />
                    <Checkbox
                        label="Absolute"
                        labelClassName={BindingModalStyles.labelCheckbox}
                        checked={isAbsolute}
                        aria-label="Absolute"
                        disabled={!hasOptions}
                        onChange={(e) => setIsAbsolute(e.target.checked)}
                    />
                    <button aria-label="Add Binding" className={BindingModalStyles.addButton} onClick={() => addBinding()} disabled={!hasOptions}>
                        {viewportWidth <= 768 ? <AddCircleOutlineIcon /> : "Add binding"}
                    </button>
                </div>
            </section>
        );
    }

    // Defined bindings interface definition
    const renderBindings = () => {
        const allBindings = [
            ...bindings.map(item => ({ ...item, source: 'bindings' })),
            ...tempBindings.map(item => ({ ...item, source: 'tempBindings' }))
        ];

        return (
            <section aria-labelledby="defined-bindings-title">
                <h3 id="defined-bindings-title" className="visually-hidden">Defined Bindings</h3>{
                    allBindings.map((binding, index) => (
                        <div
                            key={binding.id}
                            className={`${BindingModalStyles.bindingRow} ${activeBindings.includes(binding.id) ? BindingModalStyles.bindingRowActive : ''}`}
                            style={{ backgroundColor: binding.source === 'tempBindings' ? "#e9e9e9" : "white" }}>
                            <div className={BindingModalStyles.bindingName}>{binding.label}</div>
                            <div className={BindingModalStyles.bindingExpression}>
                                {binding.operator === '='
                                    ? `assigned as ${binding.secondValue.label}`
                                    : `${binding.firstValue.label} ${binding.operator === '⊆' ? 'is contained in'
                                        : binding.operator} ${binding.secondValue.label}`}
                            </div>
                            <Checkbox
                                label="Show in results"
                                labelClassName={BindingModalStyles.labelCheckbox}
                                checked={binding.showInResults}
                                onChange={() => {
                                    const sourceList = binding.source === 'bindings' ? bindings : tempBindings;
                                    const sourceIndex = sourceList.findIndex(item => item.id === binding.id);
                                    const updatedBindings = [...sourceList];
                                    updatedBindings[sourceIndex] = {
                                        ...updatedBindings[sourceIndex],
                                        showInResults: !updatedBindings[sourceIndex].showInResults
                                    };
                                    binding.source === 'bindings' ? setBindings(updatedBindings) : setTempBindings(updatedBindings);
                                }}
                            />
                            <Checkbox
                                label="Absolute"
                                labelClassName={BindingModalStyles.labelCheckbox}
                                checked={binding.isAbsolute}
                                onChange={() => {
                                    const sourceList = binding.source === 'bindings' ? bindings : tempBindings;
                                    const sourceIndex = sourceList.findIndex(item => item.id === binding.id);
                                    const updatedBindings = [...sourceList];
                                    updatedBindings[sourceIndex] = {
                                        ...updatedBindings[sourceIndex],
                                        isAbsolute: !updatedBindings[sourceIndex].isAbsolute
                                    };
                                    binding.source === 'bindings' ? setBindings(updatedBindings) : setTempBindings(updatedBindings);
                                }}
                            />
                            <button
                                className={BindingModalStyles.bindingRemove}
                                onClick={() => handleRemoveVariable(binding.id, binding.source)}
                                aria-label={`Remove Binding ${binding.id}`}>
                                <DeleteIcon />
                            </button>
                        </div>
                    ))
                }
            </section>
        );
    }

    return (
        <ModalWrapper isOpen={isBindingsOpen} closeModal={handleClose} maxWidth={1500} aria-labelledby="modal-title">
            <div className={BindingModalStyles.modalHeader}>
                <h2 id="modal-title">Bindings and Variables</h2>
            </div>
            <div className={`${BindingModalStyles.modalContent} ${showBindingBuilder ? BindingModalStyles.showBindingBuilder : ""}`}>
                {renderBindings()}
                {bindingBuilder()}
            </div>
            <button className={BindingModalStyles.closeBtn} onClick={handleClose} aria-label="Close">
                <CloseIcon style={{ color: 'white', marginBottom: "-7px" }} />
            </button>
            <footer className={BindingModalStyles.modalActions}>
                <div className={BindingModalStyles.actionsContainer}>
                    <button className={BindingModalStyles.setBtn} onClick={handleSubmit} aria-label="Set Bindings">
                        Set bindings
                    </button>
                    <button onClick={toggleBindingBuilderVisibility} className={BindingModalStyles.toggleButton} aria-label="Toggle Binding Builder">
                        <ExpandMoreIcon style={{ transform: showBindingBuilder ? 'rotate(180deg)' : 'rotate(0)' }} />
                    </button>
                    <button className={BindingModalStyles.cancelBtn} onClick={handleClose} aria-label="Cancel and Close">
                        Cancel
                    </button>
                </div>
            </footer>
        </ModalWrapper>
    );
}

export default BindingsModal;
