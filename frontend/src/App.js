import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [currentLeaves, setCurrentLeaves] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('employees');
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [showEditLeave, setShowEditLeave] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);

  // Form states
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    start_date: '',
    contract_type: 'CDI',
    total_leave_hours: ''
  });
  
  const [newLeave, setNewLeave] = useState({
    employee_id: '',
    start_date: '',
    end_date: '',
    hours_count: 8,
    leave_type: 'Congé payé'
  });

  const [editLeaveData, setEditLeaveData] = useState({
    total_hours: 0,
    used_hours: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadEmployees(),
        loadCurrentLeaves(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await axios.get(`${API}/employees`);
      setEmployees(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des employés:', error);
    }
  };

  const loadCurrentLeaves = async () => {
    try {
      const response = await axios.get(`${API}/leaves/current`);
      setCurrentLeaves(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des congés:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des stats:', error);
    }
  };

  const initSampleData = async () => {
    try {
      await axios.post(`${API}/init-sample-data`);
      await loadData();
    } catch (error) {
      console.error('Erreur lors de l\'initialisation:', error);
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/employees`, newEmployee);
      setNewEmployee({ name: '', start_date: '', contract_type: 'CDI', total_leave_hours: '' });
      setShowAddEmployee(false);
      await loadData();
    } catch (error) {
      console.error('Erreur lors de l\'ajout:', error);
    }
  };

  const handleAddLeave = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/leaves`, newLeave);
      setNewLeave({ employee_id: '', start_date: '', end_date: '', hours_count: 8, leave_type: 'Congé payé' });
      setShowAddLeave(false);
      await loadData();
    } catch (error) {
      console.error('Erreur lors de l\'ajout du congé:', error);
      alert('Erreur: Vérifiez que l\'employé a assez d\'heures de congé disponibles');
    }
  };

  const handleEditLeaveBalance = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/employees/${editingEmployee.id}/leave-balance`, {
        total_hours: parseInt(editLeaveData.total_hours),
        used_hours: parseInt(editLeaveData.used_hours)
      });
      setShowEditLeave(false);
      setEditingEmployee(null);
      await loadData();
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
      alert('Erreur lors de la modification du solde de congés');
    }
  };

  const openEditModal = (employee) => {
    setEditingEmployee(employee);
    setEditLeaveData({
      total_hours: employee.total_leave_hours || 0,
      used_hours: employee.used_leave_hours || 0
    });
    setShowEditLeave(true);
  };

  const handleCancelLeave = async (leaveId) => {
    if (window.confirm('Voulez-vous vraiment annuler ce congé ?')) {
      try {
        await axios.delete(`${API}/leaves/${leaveId}`);
        await loadData();
      } catch (error) {
        console.error('Erreur lors de l\'annulation:', error);
      }
    }
  };

  const getContractColor = (contractType) => {
    switch (contractType) {
      case 'CDI': return 'text-green-600 bg-green-100';
      case 'CDD': return 'text-orange-600 bg-orange-100';
      case 'Art.60': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getLeaveProgress = (used, total) => {
    const percentage = (used / total) * 100;
    return Math.min(percentage, 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Gestion Brigade</h1>
              <p className="text-gray-600 mt-1">Tableau de bord - Employés et Congés</p>
            </div>
            <div className="mt-4 md:mt-0 flex gap-3">
              <button
                onClick={initSampleData}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-xl transition-colors"
              >
                Données Test
              </button>
              <button
                onClick={() => setShowAddEmployee(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl transition-colors"
              >
                + Employé
              </button>
              <button
                onClick={() => setShowAddLeave(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl transition-colors"
              >
                + Congé
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="stats-card stats-card-total">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Total Employés</p>
                <p className="text-white text-2xl font-bold">{stats.total_employees || 0}</p>
              </div>
              <div className="text-white/60">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="stats-card stats-card-available">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Disponibles</p>
                <p className="text-white text-2xl font-bold">{stats.available_employees || 0}</p>
              </div>
              <div className="text-white/60">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="stats-card stats-card-leave">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">En Congé</p>
                <p className="text-white text-2xl font-bold">{stats.employees_on_leave || 0}</p>
              </div>
              <div className="text-white/60">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"/>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="stats-card stats-card-progress">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Taux Présence</p>
                <p className="text-white text-2xl font-bold">
                  {stats.total_employees ? Math.round((stats.available_employees / stats.total_employees) * 100) : 0}%
                </p>
              </div>
              <div className="text-white/60">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-lg mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('employees')}
              className={`flex-1 px-6 py-4 text-center font-medium rounded-tl-2xl transition-colors ${
                activeTab === 'employees' 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-gray-600 hover:text-indigo-600'
              }`}
            >
              📋 Employés ({employees.length})
            </button>
            <button
              onClick={() => setActiveTab('leaves')}
              className={`flex-1 px-6 py-4 text-center font-medium rounded-tr-2xl transition-colors ${
                activeTab === 'leaves' 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-gray-600 hover:text-indigo-600'
              }`}
            >
              🏖️ Congés en Cours ({currentLeaves.length})
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'employees' && (
              <div className="grid gap-4">
                {employees.map((employee) => (
                  <div key={employee.id} className="bg-gray-50 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-800">{employee.name}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getContractColor(employee.contract_type)}`}>
                            {employee.contract_type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Embauché le: {new Date(employee.start_date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      
                      <div className="mt-3 md:mt-0 flex flex-col items-end">
                        <div className="text-right mb-2">
                          <p className="text-sm text-gray-600">Congés disponibles</p>
                          <p className="text-xl font-bold text-indigo-600">
                            {employee.remaining_leave_hours || 0} / {employee.total_leave_hours || 0} heures
                          </p>
                        </div>
                        
                        <div className="flex gap-2 mb-2">
                          <button
                            onClick={() => openEditModal(employee)}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                          >
                            ✏️ Modifier
                          </button>
                        </div>
                        
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${getLeaveProgress(employee.used_leave_hours, employee.total_leave_hours)}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {employee.used_leave_hours || 0} heures utilisées
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {employees.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">Aucun employé trouvé</p>
                    <button
                      onClick={initSampleData}
                      className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl transition-colors"
                    >
                      Ajouter des données test
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'leaves' && (
              <div className="grid gap-4">
                {currentLeaves.map((leave) => (
                  <div key={leave.id} className="bg-red-50 border-l-4 border-red-400 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">{leave.employee_name}</h3>
                        <p className="text-sm text-gray-600">
                          Du {new Date(leave.start_date).toLocaleDateString('fr-FR')} 
                          au {new Date(leave.end_date).toLocaleDateString('fr-FR')}
                        </p>
                        <p className="text-sm text-gray-600">
                          {leave.hours_count} heures - {leave.leave_type}
                        </p>
                      </div>
                      
                      <button
                        onClick={() => handleCancelLeave(leave.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ))}
                
                {currentLeaves.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">Aucun congé en cours</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Ajouter un employé</h2>
            <form onSubmit={handleAddEmployee}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom</label>
                <input
                  type="text"
                  required
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Date d'embauche</label>
                <input
                  type="date"
                  required
                  value={newEmployee.start_date}
                  onChange={(e) => setNewEmployee({...newEmployee, start_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Type de contrat</label>
                <select
                  value={newEmployee.contract_type}
                  onChange={(e) => {
                    const contractType = e.target.value;
                    let defaultHours = '';
                    if (contractType === 'CDI') defaultHours = '200';
                    else if (contractType === 'CDD') defaultHours = '160';
                    else if (contractType === 'Art.60') defaultHours = '120';
                    
                    setNewEmployee({
                      ...newEmployee, 
                      contract_type: contractType,
                      total_leave_hours: newEmployee.total_leave_hours || defaultHours
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="CDI">CDI (défaut: 200h)</option>
                  <option value="CDD">CDD (défaut: 160h)</option>
                  <option value="Art.60">Art.60 (défaut: 120h)</option>
                </select>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Heures de congé totales</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newEmployee.total_leave_hours}
                  onChange={(e) => setNewEmployee({...newEmployee, total_leave_hours: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="ex: 200"
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 Modifiez ce nombre selon les heures spécifiques du travailleur
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddEmployee(false)}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl transition-colors"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Leave Modal */}
      {showAddLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Ajouter un congé</h2>
            <form onSubmit={handleAddLeave}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Employé</label>
                <select
                  required
                  value={newLeave.employee_id}
                  onChange={(e) => setNewLeave({...newLeave, employee_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Sélectionner un employé</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.remaining_leave_hours || 0} heures restantes)
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Date de début</label>
                <input
                  type="date"
                  required
                  value={newLeave.start_date}
                  onChange={(e) => setNewLeave({...newLeave, start_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Date de fin</label>
                <input
                  type="date"
                  required
                  value={newLeave.end_date}
                  onChange={(e) => setNewLeave({...newLeave, end_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Heures de congé</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newLeave.hours_count}
                  onChange={(e) => setNewLeave({...newLeave, hours_count: parseInt(e.target.value) || 8})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="8"
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Type de congé</label>
                <select
                  value={newLeave.leave_type}
                  onChange={(e) => setNewLeave({...newLeave, leave_type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="Congé payé">Congé payé</option>
                  <option value="Congé maladie">Congé maladie</option>
                  <option value="Congé sans solde">Congé sans solde</option>
                  <option value="Formation">Formation</option>
                </select>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddLeave(false)}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl transition-colors"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Leave Balance Modal */}
      {showEditLeave && editingEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              Modifier les congés - {editingEmployee.name}
            </h2>
            <form onSubmit={handleEditLeaveBalance}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total heures de congé
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editLeaveData.total_hours}
                  onChange={(e) => setEditLeaveData({...editLeaveData, total_hours: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Heures utilisées
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editLeaveData.used_hours}
                  onChange={(e) => setEditLeaveData({...editLeaveData, used_hours: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h3 className="font-medium text-gray-700 mb-2">Résumé :</h3>
                <p className="text-sm text-gray-600">
                  Heures restantes: {(editLeaveData.total_hours || 0) - (editLeaveData.used_hours || 0)} heures
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditLeave(false)}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-xl transition-colors"
                >
                  Sauvegarder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <EmployeeManagement />
    </div>
  );
}

export default App;