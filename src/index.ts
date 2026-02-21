import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { middlewareError } from './middleware/middlewareError.js';
import { requestLogger } from './middleware/requestLogger.js';

import authRouter from './routes/auth.js';
import roomTypesRouter from './routes/roomTypes.js';
import roomsRouter from './routes/rooms.js';
import { ratePlanRouter, ratesRouter, adjustmentsRouter } from './routes/ratePlans.js';
import { availabilityRouter, inventoryRouter, roomAvailabilityRouter } from './routes/availability.js';
import guestsRouter from './routes/guests.js';
import agenciesRouter from './routes/agencies.js';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

app.use(helmet());                          
app.use(cors());                            
app.use(express.json());                    
app.use(requestLogger);                     

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', authRouter);                       
app.use('/api/room-types', roomTypesRouter);       
app.use('/api/rooms', roomsRouter);                
app.use('/api/rooms', roomAvailabilityRouter);     
app.use('/api/rate-plans', ratePlanRouter);        
app.use('/api/room-type-rates', ratesRouter);      
app.use('/api/rate-adjustments', adjustmentsRouter); 
app.use('/api/availability', availabilityRouter);  
app.use('/api/inventory', inventoryRouter);        
app.use('/api/guests', guestsRouter);            
app.use('/api/agencies', agenciesRouter);          

app.use(middlewareError);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});