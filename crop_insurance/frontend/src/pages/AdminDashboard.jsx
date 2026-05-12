import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, Users, UserPlus, Search, Download, Shield, ChevronDown, ChevronUp, CheckCircle, Plus, AlertCircle, FileText, List, ArrowRight, Trash2 } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

const INDIAN_STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"];

const POLICY_CATALOG = {
  "Drought Protection Insurance":{code:"DRT-001",coverage:40000,rate:2,unit:"acre",risks:["Low rainfall","Soil moisture deficit","Heat stress"],items:["Paddy","Wheat","Maize","Cotton","Sugarcane","Tomato","Onion","Chilli","Turmeric","Groundnut","Sunflower","Millets","Pulses","Banana","Mango","Coconut","Rubber","Coffee","Tea"],cat:"land"},
  "Flood and Waterlogging Insurance":{code:"FLO-002",coverage:50000,rate:2.5,unit:"acre",risks:["Flood","Waterlogging","River overflow","Continuous heavy rain"],items:["Paddy","Wheat","Maize","Cotton","Sugarcane","Tomato","Onion","Chilli","Turmeric","Groundnut","Sunflower","Millets","Pulses","Banana","Mango","Coconut","Rubber","Coffee","Tea"],cat:"land"},
  "Pest and Disease Protection Insurance":{code:"PDI-003",coverage:45000,rate:2,unit:"acre",risks:["Insect attack","Fungal disease","Viral infection","Bacterial disease"],items:["Paddy","Wheat","Maize","Cotton","Sugarcane","Tomato","Onion","Chilli","Turmeric","Groundnut","Sunflower","Millets","Pulses","Banana","Mango","Coconut","Rubber","Coffee","Tea"],cat:"land"},
  "Cyclone and Wind Damage Insurance":{code:"CWD-004",coverage:60000,rate:3,unit:"acre",risks:["Cyclone","Storm","High wind","Hailstorm"],items:["Paddy","Wheat","Maize","Cotton","Sugarcane","Tomato","Onion","Chilli","Turmeric","Groundnut","Sunflower","Millets","Pulses","Banana","Mango","Coconut","Rubber","Coffee","Tea"],cat:"land"},
  "Comprehensive Field Damage Insurance":{code:"CFD-005",coverage:75000,rate:4,unit:"acre",risks:["Drought","Flood","Pest and disease","Cyclone","Hailstorm","Fire"],items:["Paddy","Wheat","Maize","Cotton","Sugarcane","Tomato","Onion","Chilli","Turmeric","Groundnut","Sunflower","Millets","Pulses","Banana","Mango","Coconut","Rubber","Coffee","Tea"],cat:"land"}
};

const validateMobile = (v) => /^[6-9]\d{9}$/.test(v);

const AdminDashboard = () => {
    const { t, language } = useTranslation();
    
    // Core state
    const [activeTab, setActiveTab] = useState('claims'); // 'claims' | 'farmers' | 'register'
    const [allClaims, setAllClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('All');
    const [selectedClaim, setSelectedClaim] = useState(null);
    const [adminNote, setAdminNote] = useState('');

    // Farmer Directory State
    const [farmers, setFarmers] = useState([]);
    const [farmersLoading, setFarmersLoading] = useState(false);
    const [farmerSearch, setFarmerSearch] = useState('');
    const [expandedFarmerId, setExpandedFarmerId] = useState(null);
    const [farmerPolicies, setFarmerPolicies] = useState({});

    // Register Farmer Stepper State
    const [regStep, setRegStep] = useState(1); // 1: Farmer Details, 2: Add Policy, 3: Done!
    const [registeredFarmerId, setRegisteredFarmerId] = useState('');
    const [registeredFarmerData, setRegisteredFarmerData] = useState(null);
    const [farmerForm, setFarmerForm] = useState({
        full_name: '', mobile_number: '', address: '', state: '', district: '', village: ''
    });
    const [mobileError, setMobileError] = useState(null);
    const [regLoading, setRegLoading] = useState(false);
    const [regError, setRegError] = useState(null);

    // Policy Creation state
    const [policyForm, setPolicyForm] = useState({
        farmer_id: '', policy_type: '', crop_type: '', land_area: '', num_animals: '',
        start_date: '', end_date: ''
    });
    const [selectedCatalog, setSelectedCatalog] = useState(null);
    const [premiumCalc, setPremiumCalc] = useState(null);
    const [polSuccess, setPolSuccess] = useState(null);
    const [polError, setPolError] = useState(null);
    const [linkedPolicies, setLinkedPolicies] = useState([]);

    useEffect(() => {
        fetchAllClaims();
    }, []);

    const fetchAllClaims = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/api/admin/claims`);
            setAllClaims(response.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Farmer Directory APIs
    const fetchFarmers = async () => {
        setFarmersLoading(true);
        try {
            const response = await api.get('/api/farmers');
            setFarmers(response.data || []);
        } catch (err) {
            console.error("Error fetching farmers:", err);
        } finally {
            setFarmersLoading(false);
        }
    };

    const fetchFarmerPolicies = async (fId) => {
        try {
            const res = await api.get(`/api/farmers/${fId}/policies`);
            setFarmerPolicies(prev => ({ ...prev, [fId]: res.data || [] }));
        } catch (err) {
            console.error("Error fetching farmer policies:", err);
        }
    };

    const toggleFarmerExpand = (fId) => {
        if (expandedFarmerId === fId) {
            setExpandedFarmerId(null);
        } else {
            setExpandedFarmerId(fId);
            if (!farmerPolicies[fId]) {
                fetchFarmerPolicies(fId);
            }
        }
    };

    const downloadFarmerCard = async (fId) => {
        try {
            const response = await api.get(`/api/farmers/${fId}/card?lang=${language}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Farmer_Card_${fId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Download failed:", err);
            alert("Failed to download card");
        }
    };

    const downloadPolicyCert = async (insuranceId) => {
        try {
            const response = await api.get(`/api/policies/${insuranceId}/certificate?lang=${language}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Policy_${insuranceId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Certificate download failed:', err);
            alert("Failed to download certificate");
        }
    };

    const handleDeleteFarmer = async (fId, name) => {
        if (!window.confirm(`Are you sure you want to delete farmer "${name}" (${fId}) and all associated policies and claims? This action cannot be undone.`)) {
            return;
        }
        try {
            await api.delete(`/api/farmers/${fId}`);
            setFarmers(prev => prev.filter(f => f.farmer_id !== fId));
            if (expandedFarmerId === fId) {
                setExpandedFarmerId(null);
            }
            alert(`Farmer "${name}" deleted successfully.`);
        } catch (err) {
            console.error("Error deleting farmer:", err);
            alert(err.response?.data?.detail || "Failed to delete farmer.");
        }
    };

    // Farmer Form Actions
    const handleMobileChange = (val) => {
        const digits = val.replace(/\D/g, '').slice(0, 10);
        setFarmerForm({...farmerForm, mobile_number: digits});
        if (digits.length === 10 && !validateMobile(digits)) {
            setMobileError('Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
        } else if (digits.length > 0 && digits.length < 10) {
            setMobileError('Must be exactly 10 digits.');
        } else {
            setMobileError(null);
        }
    };

    const isFarmerFormValid = () => {
        return farmerForm.full_name && validateMobile(farmerForm.mobile_number) && farmerForm.address && farmerForm.state && farmerForm.district && farmerForm.village;
    };

    const handleFarmerSubmit = async (e) => {
        e.preventDefault();
        if (!isFarmerFormValid()) return;
        setRegLoading(true);
        setRegError(null);
        try {
            const response = await api.post('/api/farmers', farmerForm);
            setRegisteredFarmerData(response.data);
            setRegisteredFarmerId(response.data.farmer_id);
            setPolicyForm(prev => ({ ...prev, farmer_id: response.data.farmer_id }));
            setRegStep(2);
        } catch (err) {
            console.error(err);
            setRegError(err.response?.data?.detail || "Farmer registration failed.");
        } finally {
            setRegLoading(false);
        }
    };

    // Policy Form Actions
    const handlePolicyTypeChange = (type) => {
        const cat = POLICY_CATALOG[type] || null;
        setSelectedCatalog(cat);
        setPolicyForm(prev => ({...prev, policy_type: type, crop_type: '', land_area: '', num_animals: ''}));
        setPremiumCalc(null);
    };

    // Recalculate premium on input change
    useEffect(() => {
        if (!selectedCatalog) { setPremiumCalc(null); return; }
        const c = selectedCatalog;
        let qty = 1;
        if (c.cat === 'land') qty = parseFloat(policyForm.land_area) || 0;
        else if (c.cat === 'livestock') qty = parseInt(policyForm.num_animals) || 0;
        if (qty <= 0) { setPremiumCalc(null); return; }
        const totalCov = c.coverage * qty;
        const totalPrem = totalCov * c.rate / 100;
        setPremiumCalc({ totalCov, totalPrem, farmerPays: totalPrem * 0.2, govtSub: totalPrem * 0.8 });
    }, [selectedCatalog, policyForm.land_area, policyForm.num_animals]);

    const isPolicyDateValid = () => {
        if (!policyForm.start_date || !policyForm.end_date) return false;
        return policyForm.end_date >= policyForm.start_date;
    };

    const canSubmitPolicy = () => {
        if (!policyForm.policy_type || !policyForm.crop_type || !isPolicyDateValid() || !premiumCalc) return false;
        if (selectedCatalog?.cat === 'land' && (!policyForm.land_area || parseFloat(policyForm.land_area) <= 0)) return false;
        if (selectedCatalog?.cat === 'livestock' && (!policyForm.num_animals || parseInt(policyForm.num_animals) <= 0)) return false;
        return true;
    };

    const handlePolicySubmit = async (e) => {
        e.preventDefault();
        if (!canSubmitPolicy()) return;
        setPolError(null);
        setPolSuccess(null);
        try {
            const payload = {
                farmer_id: registeredFarmerId,
                policy_type: policyForm.policy_type,
                crop_type: policyForm.crop_type,
                land_area: policyForm.land_area ? parseFloat(policyForm.land_area) : null,
                num_animals: policyForm.num_animals ? parseInt(policyForm.num_animals) : null,
                start_date: policyForm.start_date,
                end_date: policyForm.end_date
            };
            const response = await api.post('/api/policies', payload);
            setPolSuccess("Policy added successfully!");
            setLinkedPolicies(prev => [...prev, response.data]);
            setPolicyForm(prev => ({...prev, policy_type: '', crop_type: '', land_area: '', num_animals: '', start_date: '', end_date: ''}));
            setSelectedCatalog(null);
            setPremiumCalc(null);
        } catch (err) {
            setPolError(err.response?.data?.detail || "Policy linkage failed.");
        }
    };

    // Claims list and NDVIs
    const displayedClaims = useMemo(() => {
        let filtered = [];
        if (filterStatus === 'All') {
            filtered = allClaims;
        } else {
            filtered = allClaims.filter(claim => {
                const claimStatus = claim.status || '';
                return claimStatus.toLowerCase().trim() === filterStatus.toLowerCase().trim();
            });
        }
        return filtered;
    }, [allClaims, filterStatus]);

    const handleUpdateStatus = async (status) => {
        try {
            await api.put(`/api/admin/claims/${selectedClaim.claim_id}`, {
                status: status,
                admin_notes: adminNote
            });
            setSelectedClaim(null);
            setAdminNote('');
            fetchAllClaims();
        } catch (err) {
            console.error(err);
            alert("Failed to update status");
        }
    };

    const generateMockNDVIData = (damagePct) => {
        const data = [];
        const baseNDVI = 0.75 + (Math.random() * 0.1); 
        const drop = (damagePct / 100) * baseNDVI;
        
        for (let i = 1; i <= 10; i++) {
            if (i < 5) {
                data.push({ day: `Day ${i}`, ndvi: parseFloat((baseNDVI + (Math.random() * 0.05 - 0.025)).toFixed(3)) });
            } else if (i === 5) {
                data.push({ day: `Event`, ndvi: parseFloat((baseNDVI - (drop * 0.5)).toFixed(3)) });
            } else {
                data.push({ day: `Day ${i}`, ndvi: parseFloat((baseNDVI - drop + (Math.random() * 0.05 - 0.025)).toFixed(3)) });
            }
        }
        return data;
    };

    const ndviData = useMemo(() => {
        if (!selectedClaim) return [];
        return generateMockNDVIData(selectedClaim.damage_percentage || 0);
    }, [selectedClaim]);

    const getTranslatedStatus = (status) => {
        const key = status.toLowerCase();
        return t(`status.states.${key}`);
    };

    // Filter farmers
    const filteredFarmers = useMemo(() => {
        if (!farmerSearch) return farmers;
        const q = farmerSearch.toLowerCase();
        return farmers.filter(f => 
            f.farmer_id.toLowerCase().includes(q) || 
            f.full_name.toLowerCase().includes(q) || 
            f.mobile_number.includes(q) ||
            f.village.toLowerCase().includes(q)
        );
    }, [farmers, farmerSearch]);

    return (
        <div className="max-w-7xl mx-auto py-8 px-4">
            <h1 className="text-4xl font-extrabold mb-8 text-gradient text-gradient-emerald text-center">{t('admin.title')}</h1>

            {/* Premium Tab Bar */}
            <div className="flex flex-wrap justify-center gap-3 mb-8 bg-emerald-50/50 p-2 rounded-2xl max-w-2xl mx-auto border border-emerald-100/50 shadow-sm backdrop-blur-md">
                <button
                    onClick={() => setActiveTab('claims')}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'claims' ? 'bg-emerald-600 text-white shadow-md' : 'text-emerald-800 hover:bg-emerald-100/50'}`}
                >
                    📋 {t('admin.queue_title') || 'Claims Queue'}
                </button>
                <button
                    onClick={() => { setActiveTab('farmers'); fetchFarmers(); }}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'farmers' ? 'bg-emerald-600 text-white shadow-md' : 'text-emerald-800 hover:bg-emerald-100/50'}`}
                >
                    🌾 Farmer Directory
                </button>
            </div>

            {/* TAB CONTENT: CLAIMS QUEUE */}
            {activeTab === 'claims' && (
                <div className="grid md:grid-cols-3 gap-8">
                    {/* Queue Section */}
                    <div className="md:col-span-1 glass p-4 rounded-2xl border-t-4 border-emerald-500 h-[800px] flex flex-col">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b">
                            <h2 className="font-bold text-lg text-gray-800">{t('admin.queue_title')}</h2>
                            <select
                                className="p-1 border rounded text-sm bg-white"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option value="All">{t('admin.filters.all')}</option>
                                <option value="Pending">{t('admin.filters.pending')}</option>
                                <option value="Verified">{t('admin.filters.verified')}</option>
                                <option value="Approved">{t('admin.filters.approved')}</option>
                                <option value="Rejected">{t('admin.filters.rejected')}</option>
                            </select>
                        </div>

                        <div className="bg-gray-100 p-3 rounded-lg mb-4 text-xs font-mono text-gray-700 shadow-inner">
                            <p className="font-bold border-b border-gray-300 mb-1 pb-1">{t('admin.debug.panel')}</p>
                            <div className="grid grid-cols-2 gap-1">
                                <p>{t('admin.debug.total')}:</p><p className="font-bold">{allClaims.length}</p>
                                <p>{t('admin.debug.selected')}:</p><p className="font-bold">{filterStatus}</p>
                                <p>{t('admin.debug.filtered')}:</p><p className="font-bold">{displayedClaims.length}</p>
                            </div>
                        </div>

                        <div className="overflow-y-auto flex-grow space-y-3">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
                                    <p className="text-gray-500 font-medium">{t('admin.fetching')}</p>
                                </div>
                            ) : displayedClaims.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">{t('admin.no_claims')}</p>
                            ) : (
                                displayedClaims.map(claim => (
                                    <div
                                        key={claim.id}
                                        onClick={() => setSelectedClaim(claim)}
                                        className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 shadow-sm ${selectedClaim?.id === claim.id ? 'border-emerald-500 bg-emerald-50 shadow-md transform scale-[1.02]' : 'hover:bg-white border-gray-200'}`}
                                    >
                                        <div className="flex justify-between">
                                            <span className="font-bold text-sm text-gray-800">{claim.claim_id}</span>
                                            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                                                claim.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                                claim.status === 'Approved' ? 'bg-green-100 text-green-800' :
                                                claim.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                                'bg-blue-100 text-blue-800'
                                            }`}>
                                                {getTranslatedStatus(claim.status)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 truncate mt-1">{claim.farmer_name} - {claim.crop_type}</p>
                                        <p className="text-xs text-gray-500 mt-1">{claim.crop_type} • ML: <span className={claim.ml_prediction === 'Accept' ? 'text-green-600 font-bold' : claim.ml_prediction === 'Reject' ? 'text-red-600 font-bold' : 'text-yellow-600 font-bold'}>{claim.ml_prediction}</span></p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Claim Details Section */}
                    <div className="md:col-span-2">
                        {selectedClaim ? (
                            <div className="glass p-8 rounded-2xl border border-gray-100">
                                <div className="flex justify-between items-start border-b border-gray-200 pb-4 mb-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-800">{t('admin.reviewing')}: {selectedClaim.claim_id}</h2>
                                        <p className="text-gray-500">{t('admin.submitted')}: {selectedClaim.event_start_date} | {t('admin.farmer')}: <span className="font-semibold text-gray-700">{selectedClaim.farmer_name}</span></p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">{t('admin.ml_prediction')}</p>
                                        <p className={`text-2xl font-black ${selectedClaim.ml_prediction === 'Accept' ? 'text-green-600' :
                                            selectedClaim.ml_prediction === 'Reject' ? 'text-red-600' : 'text-yellow-600'
                                            }`}>
                                            {selectedClaim.ml_prediction}
                                        </p>
                                    </div>
                                </div>

                                <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                                    <div className="p-4 bg-white/50 backdrop-blur-md rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                                        <p className="font-bold text-gray-500 text-[10px] uppercase tracking-wider mb-1">{t('admin.crop_type')}</p>
                                        <p className="text-lg font-semibold text-gray-800 leading-tight">{selectedClaim.crop_type}</p>
                                    </div>
                                    <div className="p-4 bg-white/50 backdrop-blur-md rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                                        <p className="font-bold text-gray-500 text-[10px] uppercase tracking-wider mb-1">Policy ID</p>
                                        <p className="text-lg font-semibold text-gray-800 leading-tight">{selectedClaim.policy_number}</p>
                                    </div>
                                    <div className="p-4 bg-red-50/80 backdrop-blur-md rounded-xl border border-red-200 shadow-sm flex flex-col justify-center">
                                        <p className="font-bold text-red-800 text-[10px] uppercase tracking-wider mb-1">{t('admin.est_damage')}</p>
                                        <p className="text-2xl font-black text-red-600 leading-tight">{selectedClaim.damage_percentage?.toFixed(1) || 0}%</p>
                                    </div>
                                    <div className="p-4 bg-white/50 backdrop-blur-md rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                                        <p className="font-bold text-gray-500 text-[10px] uppercase tracking-wider mb-1">{t('admin.requested')}</p>
                                        <p className="text-xl font-bold text-gray-700 leading-tight">₹ {selectedClaim.requested_claim_amount?.toLocaleString('en-IN') || '0'}</p>
                                    </div>
                                    <div className="p-4 bg-emerald-50/80 backdrop-blur-md rounded-xl border border-emerald-200 shadow-sm flex flex-col justify-center">
                                        <p className="font-bold text-emerald-800 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">✨ {t('admin.suggested')}</p>
                                        <p className="text-2xl font-black text-emerald-600 leading-tight">₹ {selectedClaim.suggested_payout?.toLocaleString('en-IN') || '0'}</p>
                                    </div>
                                </div>

                                {/* Weather & Intelligence Panel */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                    {/* Fraud Detection */}
                                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                                        <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">{t('admin.fraud.title')}</h3>
                                        <div className="flex items-center gap-6">
                                            <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 ${selectedClaim.fraud_risk_level === 'High' ? 'border-red-500 bg-red-50' : selectedClaim.fraud_risk_level === 'Medium' ? 'border-yellow-500 bg-yellow-50' : 'border-emerald-500 bg-emerald-50'}`}>
                                                <span className={`text-2xl font-black ${selectedClaim.fraud_risk_level === 'High' ? 'text-red-600' : selectedClaim.fraud_risk_level === 'Medium' ? 'text-yellow-600' : 'text-emerald-600'}`}>{selectedClaim.fraud_score?.toFixed(0) || 0}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500 uppercase tracking-wide">{t('admin.fraud.risk_level')}</p>
                                                <p className={`text-xl font-bold ${selectedClaim.fraud_risk_level === 'High' ? 'text-red-600' : selectedClaim.fraud_risk_level === 'Medium' ? 'text-yellow-600' : 'text-emerald-600'}`}>
                                                    {selectedClaim.fraud_risk_level === 'High' ? t('admin.fraud.high') : selectedClaim.fraud_risk_level === 'Medium' ? t('admin.fraud.medium') : t('admin.fraud.low')}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">{t('admin.fraud.desc')}</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Weather Timeline */}
                                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                                        <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">{t('admin.weather.title')}</h3>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-gray-500 w-24">{t('admin.weather.pre')}</span>
                                                <div className="flex-1 px-4"><div className="h-1 bg-gray-200 rounded"></div></div>
                                                <span className="font-semibold text-gray-700">{t('admin.weather.clear')}, 32°C</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-gray-500 w-24">{t('admin.weather.during')}</span>
                                                <div className="flex-1 px-4"><div className="h-1 bg-red-200 rounded"></div></div>
                                                <span className="font-semibold text-red-600">{t('admin.weather.severe')}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-gray-500 w-24">{t('admin.weather.post')}</span>
                                                <div className="flex-1 px-4"><div className="h-1 bg-emerald-200 rounded"></div></div>
                                                <span className="font-semibold text-gray-700">{t('admin.weather.cloudy')}, 28°C</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl border border-gray-800 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 opacity-5 blur-[80px] rounded-full pointer-events-none"></div>
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 relative z-10">
                                            <div>
                                                <h3 className="font-bold text-emerald-400 text-lg tracking-wide">{t('admin.ndvi.title')}</h3>
                                                <p className="text-gray-400 text-xs mt-1">{t('admin.ndvi.subtitle')}</p>
                                            </div>
                                            <span className="mt-2 sm:mt-0 text-[10px] font-mono text-emerald-300 bg-emerald-900/50 border border-emerald-800 px-3 py-1 rounded-full uppercase tracking-widest">
                                                {t('admin.ndvi.live_gis')}
                                            </span>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 relative z-10">
                                            <div className="bg-black/50 border border-gray-700 rounded-xl overflow-hidden">
                                                <div className="p-2 bg-gray-800 border-b border-gray-700 text-xs text-center text-gray-300 font-semibold">{t('admin.ndvi.pre_img')}</div>
                                                <div className="h-32 bg-emerald-900/30 flex items-center justify-center overflow-hidden">
                                                    {selectedClaim.ndvi_before_map ? (
                                                        <img src={selectedClaim.ndvi_before_map} alt="NDVI Before" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="bg-black/60 px-2 py-1 rounded text-white text-xs backdrop-blur-sm">No data</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="bg-black/50 border border-gray-700 rounded-xl overflow-hidden">
                                                <div className="p-2 bg-gray-800 border-b border-gray-700 text-xs text-center text-gray-300 font-semibold">{t('admin.ndvi.post_img')}</div>
                                                <div className="h-32 bg-red-900/30 flex items-center justify-center overflow-hidden">
                                                    {selectedClaim.ndvi_after_map ? (
                                                        <img src={selectedClaim.ndvi_after_map} alt="NDVI After" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="bg-black/60 px-2 py-1 rounded text-white text-xs backdrop-blur-sm">No data</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="bg-black/50 border border-gray-700 rounded-xl overflow-hidden">
                                                <div className="p-2 bg-gray-800 border-b border-gray-700 text-xs text-center text-gray-300 font-semibold">{t('admin.ndvi.loss_heatmap')}</div>
                                                <div className="h-32 flex items-center justify-center overflow-hidden">
                                                    {selectedClaim.ndvi_diff_map ? (
                                                        <img src={selectedClaim.ndvi_diff_map} alt="NDVI Diff" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="bg-black/60 px-3 py-1 rounded text-white text-sm font-bold text-red-400 backdrop-blur-sm">{t('admin.ndvi.loss')}: -{selectedClaim.damage_percentage?.toFixed(1) || 0}%</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-emerald-900/30 border border-emerald-800/50 rounded-lg p-4 relative z-10 flex gap-3 items-start">
                                            <div className="text-emerald-400 mt-0.5">✨</div>
                                            <div>
                                                <p className="text-sm font-semibold text-emerald-300">{t('admin.insight.title')}</p>
                                                <p className="text-xs text-emerald-100/80 mt-1 leading-relaxed">
                                                    {selectedClaim.damage_percentage > 50 
                                                        ? t('admin.insight.high_stress').replace('Ha', `${selectedClaim.area_hectares ? selectedClaim.area_hectares.toFixed(2) : ''} Ha`)
                                                        : t('admin.insight.mod_stress')}
                                                    {" "} {t('admin.insight.correlation').replace('event', selectedClaim.crop_type || 'event')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-200 pt-6">
                                    <h3 className="font-bold text-gray-800 mb-2">{t('admin.decision.title')}</h3>
                                    <textarea
                                        className="w-full border border-gray-300 bg-white p-4 rounded-xl mb-4 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none resize-none shadow-sm"
                                        rows="3"
                                        placeholder={t('admin.decision.placeholder')}
                                        value={adminNote}
                                        onChange={(e) => setAdminNote(e.target.value)}
                                    ></textarea>

                                    <div className="flex flex-wrap gap-4">
                                        <button
                                            onClick={() => handleUpdateStatus('Approved')}
                                            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6 py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition flex-grow flex items-center justify-center transform hover:-translate-y-0.5"
                                        >
                                            {t('admin.decision.approve')}
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStatus('Rejected')}
                                            className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white px-6 py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition flex-grow flex items-center justify-center transform hover:-translate-y-0.5"
                                        >
                                            {t('admin.decision.reject')}
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStatus('Verified')}
                                            className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-white px-6 py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition flex-grow flex items-center justify-center transform hover:-translate-y-0.5"
                                        >
                                            {t('admin.decision.verify')}
                                        </button>
                                    </div>
                                </div>

                            </div>
                        ) : (
                            <div className="glass h-[800px] rounded-2xl border-2 border-dashed border-emerald-200 flex flex-col items-center justify-center text-center p-8">
                                <div className="bg-emerald-50 p-8 rounded-full mb-6 shadow-inner ring-4 ring-emerald-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-emerald-500">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-extrabold text-gray-800 tracking-tight">{t('admin.empty.title')}</h3>
                                <p className="text-gray-500 mt-3 max-w-md text-lg leading-relaxed">
                                    {t('admin.empty.desc')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: FARMER DIRECTORY */}
            {activeTab === 'farmers' && (
                <div className="glass p-8 rounded-3xl shadow-xl min-h-[600px] border border-white/50">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-6 mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                <Users className="w-7 h-7 text-emerald-600" /> Farmer Directory
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">Search, manage, and download cards for registered farmers.</p>
                        </div>
                        
                        {/* Search Input */}
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, ID, mobile, or village..."
                                value={farmerSearch}
                                onChange={(e) => setFarmerSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl input-glass border border-gray-200 focus:border-emerald-500 outline-none text-sm transition"
                            />
                        </div>
                    </div>

                    {farmersLoading ? (
                        <div className="flex flex-col items-center justify-center py-24">
                            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
                            <p className="text-gray-500 font-medium">Fetching registered farmers...</p>
                        </div>
                    ) : filteredFarmers.length === 0 ? (
                        <div className="text-center py-24">
                            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500 text-lg font-semibold">No farmers found</p>
                            <p className="text-gray-400 text-sm mt-1">Try refining your search or register a new farmer.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredFarmers.map(farmer => {
                                const isExpanded = expandedFarmerId === farmer.farmer_id;
                                const policies = farmerPolicies[farmer.farmer_id] || [];
                                
                                return (
                                    <div key={farmer.farmer_id} className="border border-gray-100 rounded-2xl bg-white shadow-sm overflow-hidden transition-all duration-200">
                                        <div className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50" onClick={() => toggleFarmerExpand(farmer.farmer_id)}>
                                            <div className="flex items-center gap-4">
                                                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                                    <Users className="w-6 h-6 text-emerald-600" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-gray-800 text-lg">{farmer.full_name}</h3>
                                                        <span className="font-mono text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase font-bold">{farmer.farmer_id}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1">📱 {farmer.mobile_number} • 📍 {farmer.village}, {farmer.district}, {farmer.state}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => downloadFarmerCard(farmer.farmer_id)}
                                                    className="p-2.5 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 transition"
                                                    title="Download ID Card"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteFarmer(farmer.farmer_id, farmer.full_name)}
                                                    className="p-2.5 rounded-xl border border-gray-200 hover:border-red-500 hover:bg-red-50 text-gray-600 hover:text-red-700 transition"
                                                    title="Delete Farmer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => toggleFarmerExpand(farmer.farmer_id)}
                                                    className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50"
                                                >
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded Policies Area */}
                                        {isExpanded && (
                                            <div className="bg-gray-50/50 border-t border-gray-100 p-6">
                                                <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-1">🛡️ Associated Policies</h4>
                                                
                                                {policies.length === 0 ? (
                                                    <p className="text-sm text-gray-500 bg-white p-4 rounded-xl border border-dashed border-gray-200">No insurance policies active or pending for this farmer.</p>
                                                ) : (
                                                    <div className="grid sm:grid-cols-2 gap-4">
                                                        {policies.map(policy => (
                                                            <div key={policy.id} className="p-5 rounded-xl border border-gray-100 bg-white shadow-sm relative overflow-hidden group">
                                                                <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-black uppercase rounded-bl-xl ${policy.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : policy.status === 'Upcoming' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {policy.status}
                                                                </div>
                                                                <p className="text-xs text-gray-400 font-mono mb-1">{policy.insurance_id} • {policy.policy_code}</p>
                                                                <h5 className="text-base font-bold text-gray-800 mb-1">{policy.policy_type}</h5>
                                                                <p className="text-xs text-gray-500 mb-3">{policy.crop_type}</p>
                                                                
                                                                <div className="flex justify-between items-end border-t border-gray-50 pt-3 mt-3">
                                                                    <div>
                                                                        <p className="text-[10px] text-gray-400 uppercase font-bold">Total Coverage</p>
                                                                        <p className="text-lg font-black text-emerald-600">₹ {policy.total_coverage?.toLocaleString()}</p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => downloadPolicyCert(policy.insurance_id)}
                                                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                                                    >
                                                                        <Download className="w-3 h-3" /> Certificate
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};

export default AdminDashboard;

