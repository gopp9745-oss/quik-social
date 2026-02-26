# Quik Social Network

Социальная сеть как ВКонтакте.

## 🚀 Быстрый старт

### Локальный запуск:
```bash
cd server
npm install
npm start
```
Откройте http://localhost:3000

## ☁️ Деплой на Render.com

### Автоматический деплой:
1. Зарегистрируйтесь на https://render.com
2. Подключите GitHub аккаунт
3. Создайте новый Web Service:
   - Repository: gopp9745-oss/quik-social
   - Branch: main
   - Build Command: npm install
   - Start Command: npm start
   - Runtime: Node

### Переменные окружения:
- NODE_ENV=production
- PORT=3000

## 📱 Функции

- Регистрация и вход
- Посты с фото
- Лайки и комментарии
- Мессенджер
- Создание групп
- Поиск друзей

## 🛠 Технологии

- Node.js + Express
- Socket.io для мессенджера
- JSON база данных
- HTML/CSS/JS frontend
