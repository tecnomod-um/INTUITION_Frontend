import React from 'react';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowLeft from '@mui/icons-material/ArrowLeft';
import UnionListElementStyles from './unionListElement.module.css';

function UnionListElement({ id, label, removeDisabled, activeGraphId, changeActiveGraph, isGraphLoop, addGraphNode, removeGraph }) {

    const isActive = id === activeGraphId;
    
    const handleClick = (event) => {
        event.preventDefault();
        changeActiveGraph(id);
    }

    const handleArrowClick = (event) => {
        event.stopPropagation();
        if (!isGraphLoop)
            addGraphNode(id);
    }

    const handleDeleteClick = (event) => {
        event.stopPropagation();
        if (!removeDisabled)
            removeGraph(id);
    }

    return (
        <li className={`${UnionListElementStyles.element} ${isActive ? UnionListElementStyles.active : ''}`} onClick={e => handleClick(e)}>
            <button className={UnionListElementStyles.arrowBtn} disabled={isGraphLoop} onClick={handleArrowClick}
                title={isGraphLoop ? "Adding this graph to the active one would cause a loop." : ""}>
                <ArrowLeft style={{ fontSize: '34px' }} />
            </button>
            <span>{label}</span>
            <button className={UnionListElementStyles.deleteBtn} disabled={removeDisabled} onClick={handleDeleteClick}
                title={removeDisabled ? "A minimum of one graph is required." : ""}>
                <DeleteIcon style={{ color: 'white' }} />
            </button>
        </li>
    );
}

export default UnionListElement;
