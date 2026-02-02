#!/usr/bin/env python3
"""
Fibonacci sequence generator
Autonomous code by OpenClaw
"""

def fibonacci(n):
    """Generate first n numbers of the Fibonacci sequence"""
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    elif n == 2:
        return [0, 1]
    
    sequence = [0, 1]
    for i in range(2, n):
        sequence.append(sequence[i-1] + sequence[i-2])
    return sequence


def main():
    n = 10
    fib_sequence = fibonacci(n)
    
    print(f"First {n} Fibonacci numbers:")
    for i, num in enumerate(fib_sequence):
        print(f"F({i}) = {num}")


if __name__ == "__main__":
    main()
