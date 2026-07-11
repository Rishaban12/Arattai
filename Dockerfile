FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY backend/ backend/
RUN mvn package -DskipTests -q

FROM tomcat:10.1-jdk21
RUN rm -rf /usr/local/tomcat/webapps/*
# Disable Tomcat's shutdown socket so port 8005 is never opened
RUN sed -i 's/port="8005"/port="-1"/' /usr/local/tomcat/conf/server.xml
COPY --from=build /app/target/arattai.war /usr/local/tomcat/webapps/ROOT.war
EXPOSE 8080
CMD ["catalina.sh", "run"]
