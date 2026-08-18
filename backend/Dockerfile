# ビルドは CI(GitHub Actions)側で行い、ここでは事前ビルド済みの
# bin/main と out/ をコピーするだけ。EC2(t3.nano, 0.5GB RAM)上で
# Next.js/Go のフルビルドを走らせるとメモリ不足でスワップ地獄になるため。
FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY bin/main /bin/main
COPY config/environments/config.yaml /config/environments/config.yaml
COPY out /srv/myapp/
RUN chmod 755 /bin/main
CMD ["/bin/main"]
