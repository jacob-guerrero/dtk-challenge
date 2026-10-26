# KB-04 — Validación y duplicados
Documento sintético FleetPulse. Rechazar latitud fuera de [-90,90], longitud fuera de [-180,180] y velocidad negativa. Un mismo eventId y mismo contenido es duplicado: no volver a persistir evento ni generar alerta. Un eventId con contenido distinto es un conflicto que no debe sobrescribir datos. Verificar integridad y conteos antes de investigar un incidente.
