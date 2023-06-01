import axios from "axios";
import config from '../config';
import { parseQuery, parseResponse } from "./queryParser.js";

const proxyURL = config.backendUrl;
const endpointURL = config.endpointUrl;

export const handleQuery = (nodes, edges, startingVar, setIsLoading) => {
    setIsLoading(true);
    let data = {
        endpoint: endpointURL,
        query: parseQuery(nodes, edges, startingVar)
    };

    return new Promise((resolve, reject) => {
        axios({
            method: 'post',
            url: `${proxyURL}/sparql`,
            data: data,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
            .then(function (response) {
                setIsLoading(false);
                const result = parseResponse(response);
                resolve(result);
            })
            .catch(function (error) {
                console.log(error);
                setIsLoading(false);
                reject(error);
            });
    });
};

export const handleDataPropertiesFetch = () => {
    return new Promise((resolve, reject) => {
        axios({
            method: 'get',
            url: `${proxyURL}/data/data_properties`,
            headers: { 'Content-Type': 'application/json' }
        })
            .then(function (response) {
                resolve(response.data);
            })
            .catch(function (error) {
                console.log(error);
                reject(error);
            });
    });
};

export const handleNodeDataFetch = () => {
    return new Promise((resolve, reject) => {
        axios({
            method: 'get',
            url: `${proxyURL}/data/nodes`,
            headers: { 'Content-Type': 'application/json' }
        })
            .then(function (response) {
                resolve(response.data);
            })
            .catch(function (error) {
                console.log(error);
                reject(error);
            });
    });
};

export const handleObjectPropertiesFetch = () => {
    return new Promise((resolve, reject) => {
        axios({
            method: 'get',
            url: `${proxyURL}/data/object_properties`,
            headers: { 'Content-Type': 'application/json' }
        })
            .then(function (response) {
                resolve(response.data);
            })
            .catch(function (error) {
                console.log(error);
                reject(error);
            });
    });
};

export const handleVarDataFetch = () => {
    return new Promise((resolve, reject) => {
        axios({
            method: 'get',
            url: `${proxyURL}/data/vars`,
            headers: { 'Content-Type': 'application/json' }
        })
            .then(function (response) {
                resolve(response.data);
            })
            .catch(function (error) {
                console.log(error);
                reject(error);
            });
    });
};