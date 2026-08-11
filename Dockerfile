FROM node:24-alpine
LABEL org.opencontainers.image.title="db-vendo-client"
LABEL org.opencontainers.image.description="A clean REST API wrapping around the new Deutsche Bahn API."
LABEL org.opencontainers.image.authors="Traines <git@traines.eu>"
LABEL org.opencontainers.image.documentation="https://github.com/public-transport/db-vendo-client"
LABEL org.opencontainers.image.source="https://github.com/public-transport/db-vendo-client"
LABEL org.opencontainers.image.licenses="ISC"
WORKDIR /app

# install dependencies
#RUN apk add --update git
ADD package.json package-lock.json /app/
RUN npm install && npm cache clean --force

# add source code
ADD . /app

EXPOSE 3000

ENV PORT 3000

CMD ["node", "api.js"]
