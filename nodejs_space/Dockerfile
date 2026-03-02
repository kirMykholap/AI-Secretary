FROM node:18-alpine AS builder

WORKDIR /usr/src/app

COPY package.json yarn.lock ./
COPY prisma ./prisma/

# Enable corepack for yarn v4
RUN corepack enable

# Install dependencies
RUN yarn install --frozen-lockfile

COPY . .

# Generate Prisma client and build application
RUN yarn prisma generate
RUN yarn build

FROM node:18-alpine

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/yarn.lock ./
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

EXPOSE 3000

# Start command (with migrations applied automatically)
CMD ["sh", "-c", "yarn prisma migrate deploy && yarn start:prod"]
