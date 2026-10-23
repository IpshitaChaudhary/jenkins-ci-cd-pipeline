# jenkins-ci-cd-pipeline

End-to-end CI/CD with Jenkins for a small Node.js service: unit tests, a SonarQube quality gate, a Docker image scanned with Trivy, and a Kubernetes deployment. Built up stage by stage; this README tracks what exists today.

## Status

| Stage | State |
|---|---|
| Checkout, install, unit tests (JUnit + coverage published) | Done |
| Docker image build (multi-stage, non-root, health check) | Done |
| SonarQube analysis + quality gate | Next |
| Trivy image scan (fail on HIGH/CRITICAL) | Planned |
| Push to registry, deploy to Kubernetes | Planned |

## Layout

```
.
├── Jenkinsfile           # declarative pipeline
└── app/                  # the workload: inventory-api (Express)
    ├── src/              # app.js (routes), server.js (listener + graceful shutdown)
    ├── test/             # Jest + Supertest
    ├── Dockerfile
    └── package.json
```

## The service

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness/readiness check used by Docker and Kubernetes |
| `GET /api/items` | List items |
| `GET /api/items/:id` | One item, 404 if unknown |
| `POST /api/items` | Create an item; 400 on invalid input |

## Run it locally

```bash
cd app
npm ci
npm test            # unit tests + coverage (fails below 80% lines / 70% branches)
npm start           # http://localhost:3000/health
```

With Docker:

```bash
docker build -t inventory-api:local app
docker run --rm -p 3000:3000 inventory-api:local
```

## Pipeline design notes

- **Image tags are the short commit SHA**, never `latest`, so every running image maps to exactly one commit.
- **Tests run in a throwaway `node:20-alpine` container**, so the Jenkins agent needs only Docker, not a Node toolchain.
- **No secrets in the Jenkinsfile.** Tokens (SonarQube, registry) will come from Jenkins credentials bindings.
