FROM alpine:3.15.0
COPY ./bin/main /bin/main
COPY ./config/environments/config.yaml  /config/environments/config.yaml
COPY ./.env /srv/
COPY ./init.sh /srv/
COPY ./out  /srv/myapp/
RUN apk add gcompat
RUN chmod 777 /bin/main
RUN chmod 777 /srv/init.sh
CMD ["/srv/init.sh"]
