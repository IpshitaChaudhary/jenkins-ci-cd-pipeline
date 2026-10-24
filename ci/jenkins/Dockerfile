# Jenkins LTS + Docker CLI + the plugins this pipeline uses, so a fresh local Jenkins can run the
# Jenkinsfile without clicking through the plugin manager.
FROM jenkins/jenkins:lts-jdk17

USER root
# Docker CLI only (the daemon is the host's, via the mounted socket).
RUN apt-get update \
 && apt-get install -y --no-install-recommends docker.io \
 && rm -rf /var/lib/apt/lists/*
USER jenkins

COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt
