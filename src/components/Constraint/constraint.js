import React, { useState } from "react";
import ConstraintStyles from "./constraint.module.css";

function darken(color, amount) {
    const hex = color.replace("#", "");
    const rgb = [0, 2, 4].map((idx) => parseInt(hex.slice(idx, idx + 2), 16));
    const newRgb = rgb.map((c) => Math.max(c - Math.round((amount * c) / 100), 0));
    return `#${newRgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function Constraint({ id, data, type, color, addNode, isVar, graph }) {
    const [isHovered, setIsHovered] = useState(false);

    const label = isVar ? `${id} variable` : id;

    const listItemStyle = {
        backgroundColor: isHovered ? color : "#f9f9f9",
        boxShadow: isHovered ? `0 0 10px ${darken(color, 60)}` : "none",
    };

    const handleMouseEnter = () => {
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    const handleClick = (event) => {
        event.preventDefault();
        addNode(id, data, type, isVar, graph);
    };

    return (
        <li
            style={listItemStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={ConstraintStyles.element}
            onClick={handleClick}
        >
            <h2>{label}</h2>
            <p>{data}</p>
        </li>
    );
}

export default Constraint;
