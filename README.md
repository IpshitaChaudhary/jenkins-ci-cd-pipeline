# jenkins-ci-cd-pipeline

End-to-end CI/CD with Jenkins for a small Node.js service: unit tests, a SonarQube quality gate, a Docker image scanned with Trivy, and a Kubernetes deployment. Built up stage by stage; this README tracks what exists today.

## Status

| Stage | State |
|---|---|
| Checkout, install, unit tests (JUnit + coverage published) | Done |
| Docker image build (multi-stage, non-root, health check) | Done |
| SonarQube analysis + quality gate (blocks the image build) | Done |
| Trivy image scan (fail on HIGH/CRITICAL) | Next |
| Push to registry, deploy to Kubernetes | Planned |

## Layout

```
.
├── Jenkinsfile           # declarative pipeline
├── ci/                   # local Jenkins + SonarQube (docker compose)
│   ├── docker-compose.yml
│   └── jenkins/          # Jenkins LTS + Docker CLI + plugins.txt
└── app/                  # the workload: inventory-api (Express)
    ├── src/              # app.js (routes), server.js (listener + graceful shutdown)
    ├── test/             # Jest + Supertest
    ├── Dockerfile
    ├── sonar-project.properties
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

## Run the pipeline locally (Jenkins + SonarQube)

```bash
# SonarQube's Elasticsearch needs this on a Linux host (Docker Desktop already has it)
sudo sysctl -w vm.max_map_count=262144

docker compose -f ci/docker-compose.yml up -d --build
docker compose -f ci/docker-compose.yml exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

One-time wiring:

1. **SonarQube** (http://localhost:9000): log in, change the admin password, then *My Account → Security* → generate a token.
2. **SonarQube webhook**: *Administration → Configuration → Webhooks* → `http://jenkins:8080/sonarqube-webhook/`. The quality gate stage waits for this callback.
3. **Jenkins** (http://localhost:8080): finish the setup wizard, add the token as a *Secret text* credential (e.g. `sonarqube-token`).
4. **Jenkins → Manage Jenkins → System → SonarQube servers**: name `sonarqube`, URL `http://sonarqube:9000`, token credential from step 3.
5. Create a *Pipeline* job pointing at this repo (*Pipeline script from SCM*, script path `Jenkinsfile`).

## Pipeline design notes

- **Image tags are the short commit SHA**, never `latest`, so every running image maps to exactly one commit.
- **Tests run in a throwaway `node:20-alpine` container**, so the Jenkins agent needs only Docker, not a Node toolchain.
- **Quality gate before the image build.** Code that fails the SonarQube gate never becomes an image, so nothing downstream (scan, registry, cluster) ever sees it.
- **No secrets in the repo.** The SonarQube URL and token come from `withSonarQubeEnv`; `sonar-project.properties` holds only project settings. Registry credentials will use Jenkins credentials bindings the same way.
