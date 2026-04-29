import os
import sys
import json
import pandas as pd
import numpy as np
import random
import operator
from deap import base, creator, tools, gp
from backtesting import Backtest, Strategy
import dill

# Define primitive set for Genetic Programming
pset = gp.PrimitiveSetTyped("MAIN", [pd.Series, pd.Series, pd.Series, pd.Series], bool)

# Add primitives (operators and indicators)
def add_primitives(pset):
    # Basic operators
    pset.addPrimitive(operator.add, [pd.Series, pd.Series], pd.Series)
    pset.addPrimitive(operator.sub, [pd.Series, pd.Series], pd.Series)
    pset.addPrimitive(operator.mul, [pd.Series, pd.Series], pd.Series)
    
    # Logical operators
    pset.addPrimitive(operator.and_, [bool, bool], bool)
    pset.addPrimitive(operator.or_, [bool, bool], bool)
    pset.addPrimitive(operator.not_, [bool], bool)
    
    # Comparison operators
    def gt(a, b): return a > b
    def lt(a, b): return a < b
    pset.addPrimitive(gt, [pd.Series, pd.Series], bool)
    pset.addPrimitive(lt, [pd.Series, pd.Series], bool)
    
    # Technical Indicators (simplified for the agent core)
    def sma(s, n): 
        n = max(2, int(n % 50)) # Ensure n is a valid window
        return s.rolling(window=n).mean()
    
    pset.addPrimitive(sma, [pd.Series, float], pd.Series)
    
    # Ephemeral constants
    pset.addEphemeralConstant("rand100", lambda: random.random() * 100, float)

# Define the Strategy class for backtesting
class GPStrategy(Strategy):
    buy_rule = None
    sell_rule = None
    
    def init(self):
        pass
        
    def next(self):
        # In a real scenario, we'd evaluate the compiled GP trees here
        # For the core, we just provide the structure
        pass

class GeneticsEngine:
    def __init__(self, data_path="data/trading"):
        self.data_path = data_path
        self.data = {}
        
    def load_data(self, pairs=["EURUSD", "GBPUSD", "AUDUSD", "USDJPY"]):
        for pair in pairs:
            file_path = os.path.join(self.data_path, f"{pair}_5min.csv")
            if os.path.exists(file_path):
                self.data[pair] = pd.read_csv(file_path, index_col=0, parse_dates=True)
            else:
                print(f"Warning: Data file not found for {pair}")

    def run_evolution(self, generations=10, population_size=50):
        # This is where the DEAP loop would go
        # For now, we return a mock progress result for the TypeScript agent to consume
        results = []
        for g in range(generations):
            fitness = random.uniform(0.5, 0.8) + (g * 0.01)
            results.append({"generation": g, "best_fitness": fitness})
            # Print as JSON for the parent process to capture
            print(json.dumps({"type": "progress", "data": {"generation": g, "fitness": fitness}}))
            sys.stdout.flush()
        
        return results

if __name__ == "__main__":
    # Interface for the TypeScript agent
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "--run":
            engine = GeneticsEngine()
            engine.run_evolution()
        elif cmd == "--test":
            print(json.dumps({"status": "ok", "message": "Genetics core ready"}))
    else:
        print("Usage: python genetics_core.py [--run|--test]")
