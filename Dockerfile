FROM node:18-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar el código fuente
COPY src ./src

# Exponer puerto
EXPOSE 3000

# Iniciar aplicación
CMD ["npm", "start"]
