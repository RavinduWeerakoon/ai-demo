# Next.js standalone build: the runtime image carries only server.js, the traced
# node_modules it needs, and the static assets.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Fixed non-root UID so the pod's runAsNonRoot check passes.
USER 10001
EXPOSE 3000
CMD ["node", "server.js"]
