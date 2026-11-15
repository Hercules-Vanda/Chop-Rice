import json
import sys
import numpy as np
import pymannkendall as mk

# Simulação rápida de teste de tendência
def analisar_dados_mock():
    np.random.seed(42)
    valores = np.linspace(20, 25, 30) + np.random.normal(0, 1, 30)
    
    resultado_mk = mk.original_test(valores)
    
    resposta = {
        "tendencia": resultado_mk.trend,
        "p_valor": float(resultado_mk.p),
        "significativo": bool(resultado_mk.p < 0.05),
        "declive": float(resultado_mk.slope)
    }
    print(json.dumps(resposta))

if __name__ == "__main__":
    analisar_dados_mock()