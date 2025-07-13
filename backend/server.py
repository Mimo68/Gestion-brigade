from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, date

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Employee Models
class Employee(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    start_date: date
    contract_type: str  # CDI, CDD, Art.60
    total_leave_hours: int = 0  # Total heures de congé
    used_leave_hours: int = 0  # Heures utilisées
    remaining_leave_hours: int = 0
    
    def __init__(self, **data):
        super().__init__(**data)
        self.remaining_leave_hours = self.total_leave_hours - self.used_leave_hours

class EmployeeCreate(BaseModel):
    name: str
    start_date: date
    contract_type: str

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    contract_type: Optional[str] = None
    total_leave_hours: Optional[int] = None
    used_leave_hours: Optional[int] = None

class LeaveRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    employee_name: str
    start_date: date
    end_date: date
    days_count: int
    hours_count: int = 0  # Heures de congé
    leave_type: str = "Congé payé"
    status: str = "En cours"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class LeaveRecordCreate(BaseModel):
    employee_id: str
    start_date: date
    end_date: date
    hours_count: int = 0  # Optionnel pour les congés en heures
    leave_type: str = "Congé payé"

# Helper function to calculate leave days based on contract type
def calculate_initial_leave_days(contract_type: str) -> tuple[int, int]:
    """Returns (days, hours) based on contract type"""
    if contract_type == "CDI":
        return (25, 200)  # 25 jours + 200 heures
    elif contract_type == "CDD":
        return (20, 160)  # 20 jours + 160 heures
    elif contract_type == "Art.60":
        return (15, 120)  # 15 jours + 120 heures
    else:
        return (20, 160)

# Helper function to calculate business days between dates
def calculate_business_days(start_date: date, end_date: date) -> int:
    from datetime import timedelta
    days = 0
    current_date = start_date
    while current_date <= end_date:
        if current_date.weekday() < 5:  # Monday to Friday
            days += 1
        current_date += timedelta(days=1)
    return days

# Employee Routes
@api_router.post("/employees", response_model=Employee)
async def create_employee(employee_data: EmployeeCreate):
    total_days, total_hours = calculate_initial_leave_days(employee_data.contract_type)
    
    employee_dict = employee_data.dict()
    employee_dict['total_leave_days'] = total_days
    employee_dict['total_leave_hours'] = total_hours
    employee_dict['used_leave_days'] = 0
    employee_dict['used_leave_hours'] = 0
    
    employee = Employee(**employee_dict)
    
    await db.employees.insert_one(employee.dict())
    return employee

@api_router.get("/employees", response_model=List[Employee])
async def get_employees():
    employees = await db.employees.find().to_list(1000)
    return [Employee(**emp) for emp in employees]

@api_router.get("/employees/{employee_id}", response_model=Employee)
async def get_employee(employee_id: str):
    employee = await db.employees.find_one({"id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    return Employee(**employee)

@api_router.put("/employees/{employee_id}", response_model=Employee)
async def update_employee(employee_id: str, employee_data: EmployeeUpdate):
    update_dict = {}
    
    for field, value in employee_data.dict(exclude_unset=True).items():
        if value is not None:
            update_dict[field] = value
    
    # If contract type is updated, recalculate leave allocation
    if 'contract_type' in update_dict:
        total_days, total_hours = calculate_initial_leave_days(update_dict['contract_type'])
        update_dict['total_leave_days'] = total_days
        update_dict['total_leave_hours'] = total_hours
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    
    result = await db.employees.update_one(
        {"id": employee_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    updated_employee = await db.employees.find_one({"id": employee_id})
    return Employee(**updated_employee)

@api_router.put("/employees/{employee_id}/leave-balance")
async def update_employee_leave_balance(
    employee_id: str, 
    total_days: Optional[int] = None,
    total_hours: Optional[int] = None,
    used_days: Optional[int] = None,
    used_hours: Optional[int] = None
):
    """Mettre à jour manuellement le solde de congés d'un employé"""
    update_dict = {}
    
    if total_days is not None:
        update_dict['total_leave_days'] = total_days
    if total_hours is not None:
        update_dict['total_leave_hours'] = total_hours
    if used_days is not None:
        update_dict['used_leave_days'] = used_days
    if used_hours is not None:
        update_dict['used_leave_hours'] = used_hours
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    
    result = await db.employees.update_one(
        {"id": employee_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    updated_employee = await db.employees.find_one({"id": employee_id})
    return Employee(**updated_employee)

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str):
    result = await db.employees.delete_one({"id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    return {"message": "Employé supprimé"}

# Leave Routes
@api_router.post("/leaves", response_model=LeaveRecord)
async def create_leave_record(leave_data: LeaveRecordCreate):
    # Get employee
    employee = await db.employees.find_one({"id": leave_data.employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    # Calculate business days
    days_count = calculate_business_days(leave_data.start_date, leave_data.end_date)
    hours_count = leave_data.hours_count or 0
    
    # Check if employee has enough leave days/hours
    if employee['used_leave_days'] + days_count > employee['total_leave_days']:
        raise HTTPException(status_code=400, detail="Pas assez de jours de congé disponibles")
    
    if hours_count > 0 and employee['used_leave_hours'] + hours_count > employee['total_leave_hours']:
        raise HTTPException(status_code=400, detail="Pas assez d'heures de congé disponibles")
    
    # Create leave record
    leave_dict = leave_data.dict()
    leave_dict['employee_name'] = employee['name']
    leave_dict['days_count'] = days_count
    leave_dict['hours_count'] = hours_count
    leave_dict['status'] = "En cours"
    
    leave_record = LeaveRecord(**leave_dict)
    
    # Update employee's used leave days/hours
    new_used_days = employee['used_leave_days'] + days_count
    new_used_hours = employee['used_leave_hours'] + hours_count
    
    await db.employees.update_one(
        {"id": leave_data.employee_id},
        {"$set": {
            "used_leave_days": new_used_days,
            "used_leave_hours": new_used_hours
        }}
    )
    
    # Save leave record
    await db.leaves.insert_one(leave_record.dict())
    
    return leave_record

@api_router.get("/leaves", response_model=List[LeaveRecord])
async def get_leave_records():
    leaves = await db.leaves.find().sort("start_date", -1).to_list(1000)
    return [LeaveRecord(**leave) for leave in leaves]

@api_router.get("/leaves/current")
async def get_current_leaves():
    today = date.today()
    leaves = await db.leaves.find({
        "start_date": {"$lte": today},
        "end_date": {"$gte": today},
        "status": "En cours"
    }).to_list(1000)
    return [LeaveRecord(**leave) for leave in leaves]

@api_router.delete("/leaves/{leave_id}")
async def cancel_leave_record(leave_id: str):
    # Get leave record
    leave = await db.leaves.find_one({"id": leave_id})
    if not leave:
        raise HTTPException(status_code=404, detail="Congé non trouvé")
    
    # Update employee's used leave days/hours (subtract the days/hours)
    employee = await db.employees.find_one({"id": leave['employee_id']})
    if employee:
        new_used_days = max(0, employee['used_leave_days'] - leave['days_count'])
        new_used_hours = max(0, employee['used_leave_hours'] - leave.get('hours_count', 0))
        await db.employees.update_one(
            {"id": leave['employee_id']},
            {"$set": {
                "used_leave_days": new_used_days,
                "used_leave_hours": new_used_hours
            }}
        )
    
    # Delete leave record
    await db.leaves.delete_one({"id": leave_id})
    
    return {"message": "Congé annulé"}

# Dashboard stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    total_employees = await db.employees.count_documents({})
    
    today = date.today()
    current_leaves = await db.leaves.count_documents({
        "start_date": {"$lte": today},
        "end_date": {"$gte": today},
        "status": "En cours"
    })
    
    employees_on_leave = await db.leaves.find({
        "start_date": {"$lte": today},
        "end_date": {"$gte": today},
        "status": "En cours"
    }).to_list(1000)
    
    available_employees = total_employees - len(set(leave['employee_id'] for leave in employees_on_leave))
    
    return {
        "total_employees": total_employees,
        "current_leaves": current_leaves,
        "available_employees": available_employees,
        "employees_on_leave": len(set(leave['employee_id'] for leave in employees_on_leave))
    }

# Initialize sample data
@api_router.post("/init-sample-data")
async def init_sample_data():
    # Check if data already exists
    count = await db.employees.count_documents({})
    if count > 0:
        return {"message": "Données déjà initialisées"}
    
    # Sample employee names
    sample_names = [
        "Jean Dupont", "Marie Martin", "Pierre Durand", "Sophie Bernard", "Michel Dubois",
        "Isabelle Moreau", "François Laurent", "Catherine Simon", "Daniel Thomas", "Nathalie Robert",
        "Alain Petit", "Sylvie Roux", "Philippe David", "Brigitte Bertrand", "Gérard Morel",
        "Véronique Fournier", "Olivier Girard", "Monique Bonnet", "André François", "Christine Mercier",
        "Didier Garnier", "Françoise Fabre", "Thierry Rousseau", "Martine Vincent", "Bruno Lopez",
        "Chantal Garcia", "Patrick Rodriguez", "Annie Blanc", "Claude Martinez", "Joëlle Gonzalez",
        "Marc Sanchez", "Dominique Muller", "Yves Richard", "Nicole Leroy", "Gilbert King",
        "Jacqueline Michel", "Henri Petit", "Denise Garcia", "Roger Bernard", "Yvette Roux"
    ]
    
    contract_types = ["CDI", "CDD", "Art.60"]
    
    employees = []
    for i, name in enumerate(sample_names):
        contract = contract_types[i % 3]
        start_date = date(2020 + (i % 5), (i % 12) + 1, (i % 28) + 1)
        
        employee_data = EmployeeCreate(
            name=name,
            start_date=start_date,
            contract_type=contract
        )
        
        total_days, total_hours = calculate_initial_leave_days(contract)
        used_days = i % 10  # Random used days for demo
        used_hours = (i % 5) * 8  # Random used hours for demo
        
        employee_dict = employee_data.dict()
        employee_dict['total_leave_days'] = total_days
        employee_dict['total_leave_hours'] = total_hours
        employee_dict['used_leave_days'] = used_days
        employee_dict['used_leave_hours'] = used_hours
        
        employee = Employee(**employee_dict)
        employees.append(employee.dict())
    
    await db.employees.insert_many(employees)
    return {"message": f"{len(employees)} employés ajoutés"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()