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
import reservationsRouter, { roomAssignmentsRouter, roomConflictsRouter } from './routes/reservations.js';
import { groupsRouter, blocksRouter } from './routes/groups.js';
import { invoicesRouter, foliosRouter, depositsRouter } from './routes/invoices.js';
import housekeepingRouter from './routes/housekeeping.js';
import maintenanceRouter from './routes/maintenance.js';
import businessDateRouter from './routes/business-date.js';
import promotionsRouter from './routes/promotions.js';
import overbookingRouter from './routes/overbooking.js';
import dashboardRouter from './routes/dashboard.js';
import nightAuditRouter from './routes/night-audit.js';
import reportsRouter from './routes/reports.js';
import auditRouter from './routes/audit.js';

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
app.use('/api/reservations', reservationsRouter);  
app.use('/api/room-assignments', roomAssignmentsRouter);
app.use('/api/room-conflicts', roomConflictsRouter);
app.use('/api/groups', groupsRouter);              
app.use('/api/blocks', blocksRouter);              
app.use('/api/invoices', invoicesRouter);          
app.use('/api/folios', foliosRouter);              
app.use('/api/deposits', depositsRouter);          
app.use('/api/housekeeping', housekeepingRouter);  
app.use('/api/maintenance', maintenanceRouter);    
app.use('/api/business-date', businessDateRouter); 
app.use('/api/promotions', promotionsRouter);
app.use('/api/overbooking-policies', overbookingRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/night-audit', nightAuditRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/audit', auditRouter);

app.use(middlewareError);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});