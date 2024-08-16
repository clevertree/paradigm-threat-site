import React from "react";

export function onToggle(callback: Function) {
    return {
        onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
            if (['Enter', 'Spacebar', ' '].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                callback();
            }
        },
        onClick: (e: React.MouseEvent<HTMLElement>) => {
            e.preventDefault();
            e.stopPropagation();
            callback();
        },
    };
}