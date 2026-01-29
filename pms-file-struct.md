hotel-pms/
├── src/
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── roomController.js
│   │   ├── guestController.js
│   │   └── reservationController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── validation.js
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── User.js
│   │   ├── RoomType.js
│   │   ├── Room.js
│   │   ├── Guest.js
│   │   └── Reservation.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── rooms.js
│   │   ├── guests.js
│   │   └── reservations.js
│   ├── services/
│   │   ├── authService.js
│   │   └── reservationService.js
│   ├── utils/
│   │   └── database.js
│   ├── drizzle/
│   │   ├── schema.js
│   │   ├── seed.js
│   │   └── migrations/
│   └── app.js
├── docker-compose.yml
├── Dockerfile
├── drizzle.config.js
├── package.json
├── .env.example
├── .gitignore
└── README.md

## Create schemas, make tests, populate data, dockerize
## ✅ Before Moving to Express Server:
## - [ ] Database connection works (npm run db:test)
## - [ ] Migrations generated successfully (npm run db:generate)
## - [ ] Migrations applied successfully (npm run db:migrate)
## - [ ] All tables created in PostgreSQL
## - [ ] Indexes created correctly
## - [ ] Seed data inserted successfully (npm run db:seed)
## - [ ] Can query data with Drizzle

