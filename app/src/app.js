const express = require('express');

// In-memory store keeps the example self-contained; the pipeline is the
// point of this repo, not the persistence layer.
const items = new Map([
  [1, { id: 1, name: 'USB-C cable', stock: 120 }],
  [2, { id: 2, name: 'Laptop sleeve', stock: 35 }],
]);
let nextId = 3;

const app = express();
app.use(express.json());

// Used by the Docker HEALTHCHECK and the Kubernetes probes.
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/items', (req, res) => res.json([...items.values()]));

app.get('/api/items/:id', (req, res) => {
  const item = items.get(Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'item not found' });
  return res.json(item);
});

app.post('/api/items', (req, res) => {
  const { name, stock } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || !Number.isInteger(stock) || stock < 0) {
    return res.status(400).json({ error: 'name (string) and stock (non-negative integer) are required' });
  }
  const item = { id: nextId++, name: name.trim(), stock };
  items.set(item.id, item);
  return res.status(201).json(item);
});

module.exports = app;
