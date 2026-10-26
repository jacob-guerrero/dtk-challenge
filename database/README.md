# Database

Las migraciones SQL se aplican en orden por nombre y quedan registradas en
`schema_migrations`.

```bash
pnpm db:migrate
```

Para reiniciar solo la base local de este proyecto, el siguiente comando
elimina el volumen `postgres_data`, inicia PostgreSQL y vuelve a aplicar las
migraciones:

```bash
pnpm db:reset
```

No usar `db:reset` sobre datos que se quieran conservar.
