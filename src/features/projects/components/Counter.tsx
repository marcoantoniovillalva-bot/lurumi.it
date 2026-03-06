'use client'

import React, { useState, useEffect } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'

interface CounterProps {
    initialValue?: number
    onValueChange?: (value: number) => void
    label?: string
}

export const Counter: React.FC<CounterProps> = ({
    initialValue = 0,
    onValueChange,
    label = "Giri"
}) => {
    const [count, setCount] = useState(initialValue)

    const increment = () => {
        const newValue = count + 1
        setCount(newValue)
        onValueChange?.(newValue)
    }

    const decrement = () => {
        if (count > 0) {
            const newValue = count - 1
            setCount(newValue)
            onValueChange?.(newValue)
        }
    }

    const reset = () => {
        setCount(0)
        onValueChange?.(0)
    }

    return (
        <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-3xl shadow-lg border-2 border-primary/20">
            <span className="text-sm font-semibold text-accent uppercase tracking-wider">{label}</span>

            <div className="relative w-32 h-32 flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary shadow-inner border-4 border-white">
                <span className="text-4xl font-bold text-accent">{count}</span>
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={decrement}
                    className="p-3 rounded-full bg-secondary/20 text-accent hover:bg-secondary/40 transition-colors"
                    aria-label="Decrementa"
                >
                    <Minus size={24} />
                </button>

                <button
                    onClick={reset}
                    className="p-3 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                    aria-label="Reset"
                >
                    <RotateCcw size={20} />
                </button>

                <button
                    onClick={increment}
                    className="p-3 rounded-full bg-primary text-accent hover:opacity-80 shadow-md transition-all active:scale-95"
                    aria-label="Incrementa"
                >
                    <Plus size={24} />
                </button>
            </div>
        </div>
    )
}
