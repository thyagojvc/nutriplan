# NutriPlan — Pacote de Entrega (Fase 1)

Pacote congelado para implementação no Claude Code.

```
/
├── spec/                      decisões de produto e técnicas (fonte da verdade)
│   ├── produto_v8.md
│   ├── spec_tecnica_fase1.md
│   ├── adendo_v1_1.md
│   ├── adendo_v1_2.md
│   └── adendo_v1_3.md
├── database/                  banco validado em PostgreSQL 16
│   ├── migrations/            0001–0012 (ordem obrigatória)
│   ├── tests/                 smoke_phase1.sql (passa)
│   └── README.md              ordem, dependências, provisionamento, operação
└── IMPLEMENTATION_ORDER.md    ordem da camada de aplicação (Fases A–D)
```

Comece por `IMPLEMENTATION_ORDER.md`. Não reinterprete decisões congeladas em `/spec` e `/database`.
