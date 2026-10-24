// Declarative pipeline for inventory-api.
// Stages added so far: checkout -> install -> unit tests -> SonarQube analysis -> image build.
// Quality gate, Trivy and the Kubernetes deploy are added as later stages.
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

    stage('Build image') {
      steps {
        dir(env.APP_DIR) {
          sh 'docker build --pull -t "$IMAGE_NAME:$IMAGE_TAG" .'
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
