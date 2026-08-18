# frontend のビルド。next.js の package.json 標準 build スクリプトは
# ../../backend/out への相対コピーを含み Docker context 内では成立しないため、
# next build/export を直接叩く。
FROM node:18-alpine AS frontend-build
WORKDIR /app
COPY frontend/hamaoffice/package.json frontend/hamaoffice/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/hamaoffice/ ./
RUN npx next build && npx next export

FROM golang:1.21-alpine AS backend-build
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/main .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=backend-build /app/bin/main /bin/main
COPY --from=backend-build /app/config/environments/config.yaml /config/environments/config.yaml
COPY --from=frontend-build /app/out /srv/myapp/
RUN chmod 755 /bin/main
CMD ["/bin/main"]
