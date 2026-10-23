const app = require('./app');

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => console.log(`inventory-api listening on ${port}`));

// Containers get SIGTERM on stop; close the listener so in-flight requests finish.
process.on('SIGTERM', () => server.close(() => process.exit(0)));
