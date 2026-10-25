// Declarative pipeline for inventory-api.
// Stages added so far: checkout -> install -> unit tests -> SonarQube analysis -> quality gate ->
// image build -> Trivy scan.
// Registry push and the Kubernetes deploy are added as later stages.
pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  environment {
    APP_DIR    = 'app'
    IMAGE_NAME = 'inventory-api'
    // Short commit SHA as the image tag, so every build is traceable to a commit
    // and tags are never reused.
    IMAGE_TAG  = "${env.GIT_COMMIT ? env.GIT_COMMIT.take(7) : env.BUILD_NUMBER}"
    // Pinned so a new Trivy release can't change scan results between two builds of the same commit.
    TRIVY_VERSION = '0.56.2'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install') {
      agent {
        docker {
          image 'node:20-alpine'
          reuseNode true
        }
      }
      steps {
        dir(env.APP_DIR) {
          sh 'npm ci'
        }
      }
    }

    stage('Unit tests') {
      agent {
        docker {
          image 'node:20-alpine'
          reuseNode true
        }
      }
      steps {
        dir(env.APP_DIR) {
          sh 'npm test'
        }
      }
      post {
        always {
          junit allowEmptyResults: false, testResults: "${env.APP_DIR}/reports/junit.xml"
          archiveArtifacts artifacts: "${env.APP_DIR}/coverage/lcov.info", allowEmptyArchive: true
        }
      }
    }

    stage('SonarQube analysis') {
      agent {
        docker {
          image 'sonarsource/sonar-scanner-cli:11.1'
          // The image's entrypoint runs the scanner straight away; Jenkins needs a shell instead.
          args '--entrypoint='
          reuseNode true
        }
      }
      steps {
        // 'sonarqube' is the server name under Manage Jenkins -> System -> SonarQube servers.
        // It injects SONAR_HOST_URL and SONAR_AUTH_TOKEN; the token never appears in this file
        // or on the command line.
        withSonarQubeEnv('sonarqube') {
          dir(env.APP_DIR) {
            sh 'SONAR_TOKEN="$SONAR_AUTH_TOKEN" sonar-scanner -Dsonar.projectVersion="$IMAGE_TAG"'
          }
        }
      }
    }

    // Placed before the image build on purpose: code that fails the gate never becomes an image.
    // SonarQube reports the result back through a webhook to <jenkins>/sonarqube-webhook/,
    // so this waits for that callback instead of polling.
    stage('Quality gate') {
      steps {
        timeout(time: 5, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }

    stage('Build image') {
      steps {
        dir(env.APP_DIR) {
          sh 'docker build --pull -t "$IMAGE_NAME:$IMAGE_TAG" .'
        }
      }
    }

    // Scans the image that was just built (OS packages + npm dependencies) and fails the
    // build on HIGH/CRITICAL findings that already have a fix. Unfixed CVEs are not
    // actionable yet, so they are reported but don't block.
    stage('Trivy image scan') {
      steps {
        // Trivy reads the local image through the Docker socket; the named volume keeps its
        // vulnerability DB between builds so each scan doesn't re-download it.
        sh '''
          mkdir -p reports
          trivy() {
            docker run --rm \
              -v /var/run/docker.sock:/var/run/docker.sock \
              -v trivy-cache:/root/.cache/ \
              -v "$WORKSPACE/.trivyignore:/.trivyignore:ro" \
              "aquasec/trivy:$TRIVY_VERSION" image --no-progress --ignorefile /.trivyignore "$@"
          }

          # 1) Full report, every severity, never fails: published as test results below so each
          #    finding is visible per build. Written via stdout so no root-owned files land in the
          #    workspace.
          trivy --format template --template "@contrib/junit.tpl" --exit-code 0 \
            "$IMAGE_NAME:$IMAGE_TAG" > reports/trivy-junit.xml

          # 2) The gate. Reuses the cached DB, so this second pass is quick.
          trivy --ignore-unfixed --severity HIGH,CRITICAL --exit-code 1 "$IMAGE_NAME:$IMAGE_TAG"
        '''
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'reports/trivy-junit.xml'
        }
      }
    }
  }

  post {
    always {
      cleanWs()
    }
  }
}
