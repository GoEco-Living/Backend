# Menggunakan image resmi Node.js
FROM node:18

# Menetapkan direktori kerja dalam container
WORKDIR /usr/src/app

# Menyalin file package.json dan package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Menyalin sisa kode aplikasi ke dalam container
COPY . .

# Menjalankan aplikasi
CMD ["npm", "start"]

# Mengekspos port yang digunakan aplikasi
EXPOSE 8080
