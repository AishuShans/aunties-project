import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import { useTranslation } from '../i18n/LanguageContext';
import { UserPlus, Download, CheckCircle, ArrowRight, Shield, Plus, List, Search, AlertCircle, ChevronRight, FileText } from 'lucide-react';

const INDIAN_STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"];

const POLICY_CATALOG = {
  "Drought Protection Insurance":{code:"DRT-001",coverage:40000,rate:2,unit:"acre",risks:["Low rainfall","Soil moisture deficit","Heat stress"],items:["Paddy","Wheat","Maize","Cotton","Sugarcane","Tomato","Onion","Chilli","Turmeric","Groundnut","Sunflower","Millets","Pulses","Banana","Mango","Coconut","Rubber","Coffee","Tea"],cat:"land"},
  "Flood and Waterlogging Insurance":{code:"FLO-002",coverage:50000,rate:2.5,unit:"acre",risks:["Flood","Waterlogging","River overflow","Continuous heavy rain"],items:["Paddy","Wheat","Maize","Cotton","Sugarcane","Tomato","Onion","Chilli","Turmeric","Groundnut","Sunflower","Millets","Pulses","Banana","Mango","Coconut","Rubber","Coffee","Tea"],cat:"land"},
  "Pest and Disease Protection Insurance":{code:"PDI-003",coverage:45000,rate:2,unit:"acre",risks:["Insect attack","Fungal disease","Viral infection","Bacterial disease"],items:["Paddy","Wheat","Maize","Cotton","Sugarcane","Tomato","Onion","Chilli","Turmeric","Groundnut","Sunflower","Millets","Pulses","Banana","Mango","Coconut","Rubber","Coffee","Tea"],cat:"land"},
  "Cyclone and Wind Damage Insurance":{code:"CWD-004",coverage:60000,rate:3,unit:"acre",risks:["Cyclone","Storm","High wind","Hailstorm"],items:["Paddy","Wheat","Maize","Cotton","Sugarcane","Tomato","Onion","Chilli","Turmeric","Groundnut","Sunflower","Millets","Pulses","Banana","Mango","Coconut","Rubber","Coffee","Tea"],cat:"land"},
  "Comprehensive Field Damage Insurance":{code:"CFD-005",coverage:75000,rate:4,unit:"acre",risks:["Drought","Flood","Pest and disease","Cyclone","Hailstorm","Fire"],items:["Paddy","Wheat","Maize","Cotton","Sugarcane","Tomato","Onion","Chilli","Turmeric","Groundnut","Sunflower","Millets","Pulses","Banana","Mango","Coconut","Rubber","Coffee","Tea"],cat:"land"}
};

const validateMobile = (v) => /^[6-9]\d{9}$/.test(v);

const FarmerPolicyPage = () => {
    const { t, language } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const queryParams = new URLSearchParams(location.search);
    const initialFarmerId = queryParams.get('farmer_id') || '';

    // Step: 'choose' -> 'register' -> 'policy' -> 'done'
    // or:  'choose' -> 'existing' -> (policy management for existing farmer)
    const [step, setStep] = useState(initialFarmerId ? 'existing' : 'choose');
    const [farmerId, setFarmerId] = useState(initialFarmerId);
    const [farmerData, setFarmerData] = useState(null);

    // Farmer Registration Form
    const [farmerForm, setFarmerForm] = useState({
        full_name: '', mobile_number: '', address: '', state: '', district: '', village: ''
    });
    const [mobileError, setMobileError] = useState(null);
    const [regLoading, setRegLoading] = useState(false);
    const [regError, setRegError] = useState(null);

    // Policy Form
    const [policyForm, setPolicyForm] = useState({
        farmer_id: '', policy_type: '', crop_type: '', land_area: '', num_animals: '',
        start_date: '', end_date: ''
    });
    const [selectedCatalog, setSelectedCatalog] = useState(null);
    const [premiumCalc, setPremiumCalc] = useState(null);
    const [policies, setPolicies] = useState([]);
    const [polLoading, setPolLoading] = useState(false);
    const [polError, setPolError] = useState(null);
    const [polSuccess, setPolSuccess] = useState(null);

    // Existing farmer search
    const [searchId, setSearchId] = useState(initialFarmerId);

    useEffect(() => {
        if (farmerId) {
            fetchPolicies();
            setPolicyForm(prev => ({ ...prev, farmer_id: farmerId }));
        }
    }, [farmerId]);

    const fetchPolicies = async () => {
        setPolLoading(true);
        try {
            const res = await api.get(`/api/farmers/${farmerId}/policies`);
            setPolicies(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setPolLoading(false);
        }
    };

    // Mobile validation
    const handleMobileChange = (val) => {
        const digits = val.replace(/\D/g, '').slice(0, 10);
        setFarmerForm({...farmerForm, mobile_number: digits});
        if (digits.length === 10 && !validateMobile(digits)) setMobileError('Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
        else if (digits.length > 0 && digits.length < 10) setMobileError('Must be exactly 10 digits.');
        else setMobileError(null);
    };

    const isFarmerFormValid = () => farmerForm.full_name && validateMobile(farmerForm.mobile_number) && farmerForm.address && farmerForm.state && farmerForm.district && farmerForm.village;

    // Policy type selection
    const handlePolicyTypeChange = (type) => {
        const cat = POLICY_CATALOG[type] || null;
        setSelectedCatalog(cat);
        setPolicyForm(prev => ({...prev, policy_type: type, crop_type: '', land_area: '', num_animals: ''}));
        setPremiumCalc(null);
    };

    // Recalculate premium when inputs change
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

    // Policy date validation
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

    // --- Step 1: Register Farmer ---
    const handleFarmerSubmit = async (e) => {
        e.preventDefault();
        if (!isFarmerFormValid()) return;
        setRegLoading(true);
        setRegError(null);
        try {
            const response = await api.post('/api/farmers', farmerForm);
            setFarmerData(response.data);
            setFarmerId(response.data.farmer_id);
            setPolicyForm(prev => ({ ...prev, farmer_id: response.data.farmer_id }));
            setStep('policy');
        } catch (err) {
            console.error(err);
            setRegError(err.response?.data?.detail || t('fp.reg_failed'));
        } finally {
            setRegLoading(false);
        }
    };

    const downloadPDF = async () => {
        if (!farmerData) return;
        try {
            const response = await api.get(`/api/farmers/${farmerData.farmer_id}/card?lang=${language}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Farmer_Card_${farmerData.farmer_id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Download failed:", err);
        }
    };

    // --- Step 2: Add Policy ---
    const handlePolicySubmit = async (e) => {
        e.preventDefault();
        if (!canSubmitPolicy()) return;
        setPolError(null);
        setPolSuccess(null);
        try {
            const payload = {
                farmer_id: policyForm.farmer_id || farmerId,
                policy_type: policyForm.policy_type,
                crop_type: policyForm.crop_type,
                land_area: policyForm.land_area ? parseFloat(policyForm.land_area) : null,
                num_animals: policyForm.num_animals ? parseInt(policyForm.num_animals) : null,
                start_date: policyForm.start_date,
                end_date: policyForm.end_date
            };
            await api.post('/api/policies', payload);
            setPolSuccess(t('policies.success'));
            setPolicyForm(prev => ({...prev, policy_type: '', crop_type: '', land_area: '', num_animals: '', start_date: '', end_date: ''}));
            setSelectedCatalog(null);
            setPremiumCalc(null);
            fetchPolicies();
        } catch (err) {
            setPolError(err.response?.data?.detail || t('fp.policy_failed'));
        }
    };

    // Download policy certificate
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
        } catch (err) { console.error('Certificate download failed:', err); }
    };

    // --- Existing farmer lookup ---
    const handleSearchExisting = async () => {
        if (!searchId) return;
        setFarmerId(searchId);
        setStep('existing');
    };

    // Step indicator
    const StepIndicator = ({ currentStep }) => {
        const steps = [
            { key: 'register', label: t('fp.step1'), icon: <UserPlus className="w-4 h-4" /> },
            { key: 'policy', label: t('fp.step2'), icon: <Shield className="w-4 h-4" /> },
            { key: 'done', label: t('fp.step3'), icon: <CheckCircle className="w-4 h-4" /> },
        ];
        const currentIdx = steps.findIndex(s => s.key === currentStep);

        return (
            <div className="flex items-center justify-center gap-2 mb-10">
                {steps.map((s, i) => (
                    <React.Fragment key={s.key}>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                            i <= currentIdx
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'bg-gray-200 text-gray-500'
                        }`}>
                            {s.icon}
                            <span className="hidden sm:inline">{s.label}</span>
                        </div>
                        {i < steps.length - 1 && (
                            <ChevronRight className={`w-5 h-5 ${i < currentIdx ? 'text-emerald-500' : 'text-gray-300'}`} />
                        )}
                    </React.Fragment>
                ))}
            </div>
        );
    };

    // ===== CHOOSE SCREEN =====
    if (step === 'choose') {
        return (
            <div className="max-w-4xl mx-auto py-12 px-4">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold text-gradient mb-2">{t('fp.title')}</h1>
                    <p className="text-gray-600">{t('fp.desc')}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* New Farmer */}
                    <div
                        onClick={() => setStep('register')}
                        className="glass p-8 rounded-3xl cursor-pointer group hover:-translate-y-2 transition-all duration-300 relative overflow-hidden border-2 border-transparent hover:border-emerald-400"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100 rounded-bl-full -mr-16 -mt-16 opacity-50"></div>
                        <div className="bg-emerald-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <UserPlus className="w-8 h-8 text-emerald-600" />
                        </div>
                        <h2 className="text-2xl font-bold mb-3 text-gray-800">{t('fp.new_farmer')}</h2>
                        <p className="text-gray-600 mb-6">{t('fp.new_farmer_desc')}</p>
                        <div className="flex items-center gap-2 text-emerald-600 font-bold">
                            {t('fp.start_registration')} <ArrowRight className="w-5 h-5" />
                        </div>
                    </div>

                    {/* Existing Farmer */}
                    <div className="glass p-8 rounded-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-bl-full -mr-16 -mt-16 opacity-50"></div>
                        <div className="bg-blue-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                            <Search className="w-8 h-8 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold mb-3 text-gray-800">{t('fp.existing_farmer')}</h2>
                        <p className="text-gray-600 mb-6">{t('fp.existing_farmer_desc')}</p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={searchId}
                                onChange={(e) => setSearchId(e.target.value.toUpperCase())}
                                className="flex-grow rounded-xl input-glass p-3 font-mono"
                                placeholder="FARM2026..."
                            />
                            <button
                                onClick={handleSearchExisting}
                                disabled={!searchId}
                                className="btn-primary px-6 py-3 rounded-xl font-bold disabled:opacity-50"
                            >
                                {t('fp.search')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ===== REGISTER FARMER SCREEN =====
    if (step === 'register') {
        return (
            <div className="max-w-4xl mx-auto py-8 px-4">
                <StepIndicator currentStep="register" />

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-extrabold text-gradient mb-2">{t('registration.title')}</h1>
                    <p className="text-gray-600">{t('registration.desc')}</p>
                </div>

                {regError && <div className="bg-red-100 text-red-700 p-4 rounded-xl mb-6 text-center font-medium border border-red-200">{regError}</div>}

                <form onSubmit={handleFarmerSubmit} className="glass p-8 rounded-3xl shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-400"></div>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t('registration.full_name')}</label>
                            <input required type="text" value={farmerForm.full_name} onChange={(e) => setFarmerForm({...farmerForm, full_name: e.target.value})} className="w-full rounded-xl input-glass p-4 text-lg" placeholder="e.g. Rajesh Kumar" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t('registration.mobile')}</label>
                            <input required type="text" maxLength={10} value={farmerForm.mobile_number} onChange={(e) => handleMobileChange(e.target.value)} className={`w-full rounded-xl input-glass p-4 ${mobileError ? 'border-red-400' : ''}`} placeholder="10-digit number" />
                            {mobileError && <p className="text-xs text-red-600 mt-1">{mobileError}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t('registration.village')}</label>
                            <input required type="text" value={farmerForm.village} onChange={(e) => setFarmerForm({...farmerForm, village: e.target.value})} className="w-full rounded-xl input-glass p-4" placeholder="Village name" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t('registration.district')}</label>
                            <input required type="text" value={farmerForm.district} onChange={(e) => setFarmerForm({...farmerForm, district: e.target.value})} className="w-full rounded-xl input-glass p-4" placeholder="District" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t('registration.state')}</label>
                            <select required value={farmerForm.state} onChange={(e) => setFarmerForm({...farmerForm, state: e.target.value})} className="w-full rounded-xl input-glass p-4">
                                <option value="">Select State</option>
                                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-2">{t('registration.address')}</label>
                            <textarea required value={farmerForm.address} onChange={(e) => setFarmerForm({...farmerForm, address: e.target.value})} className="w-full rounded-xl input-glass p-4 h-32" placeholder="Full postal address..."></textarea>
                        </div>
                    </div>

                    <div className="mt-8 flex gap-4">
                        <button type="button" onClick={() => setStep('choose')} className="bg-gray-200 text-gray-700 px-6 py-4 rounded-xl font-bold hover:bg-gray-300 transition">
                            ← {t('common.back')}
                        </button>
                        <button type="submit" disabled={regLoading || !isFarmerFormValid()} className="btn-primary flex-grow py-4 rounded-xl text-lg font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-3">
                            {regLoading ? t('common.loading') : (<><UserPlus className="w-6 h-6" /> {t('registration.submit')} → </>)}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    // ===== POLICY MANAGEMENT (for new or existing farmer) =====
    const isNewFarmer = step === 'policy';
    const isExisting = step === 'existing';
    const isDone = step === 'done';

    if (isDone) {
        return (
            <div className="max-w-3xl mx-auto py-12 px-4 text-center">
                <StepIndicator currentStep="done" />
                <div className="glass p-10 rounded-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500 opacity-10 rounded-full blur-3xl"></div>
                    <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-12 h-12 text-emerald-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('fp.all_done')}</h2>
                    <p className="text-gray-600 mb-2">{t('registration.id_is')} <span className="font-black text-emerald-700 text-2xl">{farmerId}</span></p>
                    <p className="text-gray-500 mb-8">{t('fp.policies_linked')}: <span className="font-bold text-blue-700">{policies.length}</span></p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        {farmerData && (
                            <button onClick={downloadPDF} className="btn-primary flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold">
                                <Download className="w-5 h-5" /> {t('registration.download')}
                            </button>
                        )}
                        <button onClick={() => navigate('/claim')} className="bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold shadow-lg">
                            <FileText className="w-5 h-5" /> {t('fp.file_claim')}
                        </button>
                        <button onClick={() => { setStep('choose'); setFarmerId(''); setFarmerData(null); setPolicies([]); setSearchId(''); }} className="bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold">
                            {t('registration.new_reg')} <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            {isNewFarmer && <StepIndicator currentStep="policy" />}

            {/* Farmer Info Banner */}
            {(isNewFarmer && farmerData) && (
                <div className="glass p-4 rounded-2xl mb-6 flex flex-wrap items-center justify-between gap-4 border-l-4 border-emerald-500">
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">{t('fp.registered_as')}</p>
                            <p className="text-lg font-bold text-gray-800">{farmerData.full_name} <span className="text-emerald-700 font-mono text-sm ml-2">{farmerData.farmer_id}</span></p>
                        </div>
                    </div>
                    <button onClick={downloadPDF} className="flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-900 transition">
                        <Download className="w-4 h-4" /> {t('registration.download')}
                    </button>
                </div>
            )}

            {/* For existing farmer: show search bar */}
            {isExisting && (
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-extrabold text-gradient mb-2">{t('policies.title')}</h1>
                    <div className="flex items-center justify-center gap-3 mt-4 max-w-md mx-auto">
                        <input
                            type="text"
                            value={searchId}
                            onChange={(e) => setSearchId(e.target.value.toUpperCase())}
                            className="flex-grow rounded-xl input-glass pl-4 p-3 font-mono"
                            placeholder="FARM2026..."
                        />
                        <button onClick={handleSearchExisting} className="btn-primary px-6 py-3 rounded-xl font-bold">
                            <Search className="w-5 h-5" />
                        </button>
                        <button onClick={() => setStep('choose')} className="bg-gray-200 text-gray-700 px-4 py-3 rounded-xl font-bold hover:bg-gray-300 transition">
                            ← {t('common.back')}
                        </button>
                    </div>
                </div>
            )}

            {isNewFarmer && (
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-800">{t('fp.add_policy_for')} <span className="text-emerald-700">{farmerId}</span></h2>
                    <p className="text-gray-500">{t('fp.add_policy_desc')}</p>
                </div>
            )}

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Add Policy Form */}
                <div className="lg:col-span-1">
                    <form onSubmit={handlePolicySubmit} className="glass p-6 rounded-2xl shadow-lg border border-white/50 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-blue-600" /> {t('policies.add_policy')}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase">Policy Type</label>
                                <select required value={policyForm.policy_type} onChange={(e) => handlePolicyTypeChange(e.target.value)} className="w-full rounded-lg border-gray-200 p-2.5 mt-1">
                                    <option value="">Select Policy Type</option>
                                    {Object.keys(POLICY_CATALOG).map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                            </div>
                            {selectedCatalog && (
                                <>
                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                    <p className="text-[10px] font-bold text-blue-500 uppercase">Code: {selectedCatalog.code} • Rate: {selectedCatalog.rate}%</p>
                                    <p className="text-[10px] text-gray-500 mt-1">Coverage: ₹{selectedCatalog.coverage.toLocaleString()}/{selectedCatalog.unit}</p>
                                    <p className="text-[10px] text-gray-500">Risks: {selectedCatalog.risks.join(', ')}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase">Crop / Asset</label>
                                    <select required value={policyForm.crop_type} onChange={(e) => setPolicyForm({...policyForm, crop_type: e.target.value})} className="w-full rounded-lg border-gray-200 p-2.5 mt-1">
                                        <option value="">Select</option>
                                        {selectedCatalog.items.map(i => <option key={i} value={i}>{i}</option>)}
                                    </select>
                                </div>
                                {selectedCatalog.cat === 'land' && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase">Land Area (acres)</label>
                                        <input required type="number" step="0.01" min="0.01" value={policyForm.land_area} onChange={(e) => setPolicyForm({...policyForm, land_area: e.target.value})} className="w-full rounded-lg border-gray-200 p-2.5 mt-1" placeholder="e.g. 2.5" />
                                    </div>
                                )}
                                {selectedCatalog.cat === 'livestock' && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase">Number of Animals</label>
                                        <input required type="number" min="1" value={policyForm.num_animals} onChange={(e) => setPolicyForm({...policyForm, num_animals: e.target.value})} className="w-full rounded-lg border-gray-200 p-2.5 mt-1" placeholder="e.g. 3" />
                                    </div>
                                )}
                                </>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase">{t('policies.start_date')}</label>
                                    <input required type="date" value={policyForm.start_date} onChange={(e) => setPolicyForm({...policyForm, start_date: e.target.value})} className="w-full rounded-lg border-gray-200 p-2.5 mt-1 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase">{t('policies.end_date')}</label>
                                    <input required type="date" value={policyForm.end_date} onChange={(e) => setPolicyForm({...policyForm, end_date: e.target.value})} className="w-full rounded-lg border-gray-200 p-2.5 mt-1 text-sm" />
                                </div>
                            </div>
                            {policyForm.start_date && policyForm.end_date && !isPolicyDateValid() && (
                                <p className="text-xs text-red-600">End date must be on or after start date.</p>
                            )}
                            {premiumCalc && (
                                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 space-y-1">
                                    <p className="text-[10px] font-bold text-emerald-700 uppercase">Premium Calculation</p>
                                    <div className="grid grid-cols-2 gap-1 text-xs">
                                        <span className="text-gray-500">Total Coverage:</span><span className="font-bold text-gray-800">₹{premiumCalc.totalCov.toLocaleString()}</span>
                                        <span className="text-gray-500">Total Premium:</span><span className="font-bold text-gray-800">₹{premiumCalc.totalPrem.toLocaleString()}</span>
                                        <span className="text-gray-500">Farmer Pays (20%):</span><span className="font-bold text-blue-700">₹{premiumCalc.farmerPays.toLocaleString()}</span>
                                        <span className="text-gray-500">Govt Subsidy (80%):</span><span className="font-bold text-emerald-700">₹{premiumCalc.govtSub.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}

                            {polError && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{polError}</div>}
                            {polSuccess && <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" />{polSuccess}</div>}

                            <button type="submit" disabled={!canSubmitPolicy()} className="w-full btn-primary py-3 rounded-xl font-bold mt-4 shadow-lg shadow-blue-100 disabled:opacity-50">
                                {t('policies.submit')}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Policies List */}
                <div className="lg:col-span-2">
                    <div className="glass p-8 rounded-3xl shadow-xl min-h-[400px]">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 border-b pb-4">
                            <List className="w-6 h-6 text-emerald-600" />
                            {t('policies.current_policies')}
                        </h2>

                        {polLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : policies.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                                <p>{t('policies.no_policies')}</p>
                            </div>
                        ) : (
                            <div className="grid sm:grid-cols-2 gap-4">
                                {policies.map((policy) => (
                                    <div key={policy.id} className="p-5 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                        <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-black uppercase rounded-bl-xl ${policy.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : policy.status === 'Upcoming' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                            {policy.status}
                                        </div>
                                        <p className="text-xs text-gray-400 font-mono mb-1">{policy.insurance_id} • {policy.policy_code}</p>
                                        <h3 className="text-base font-bold text-gray-800 mb-1">{policy.policy_type}</h3>
                                        <p className="text-xs text-gray-500 mb-3">{policy.crop_type}</p>
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Coverage</p>
                                                <p className="text-xl font-black text-blue-700">₹ {policy.total_coverage?.toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-2 gap-1 text-[10px] text-gray-500 font-bold uppercase">
                                            <div>Farmer Pays: <span className="text-blue-700">₹{policy.farmer_premium?.toLocaleString()}</span></div>
                                            <div className="text-right">Subsidy: <span className="text-emerald-700">₹{policy.govt_subsidy?.toLocaleString()}</span></div>
                                            <div>Starts: <span className="text-gray-900">{policy.start_date}</span></div>
                                            <div className="text-right">Ends: <span className="text-gray-900">{policy.end_date}</span></div>
                                        </div>
                                        <button onClick={() => downloadPolicyCert(policy.insurance_id)} className="mt-3 w-full text-xs text-center py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-bold flex items-center justify-center gap-1 transition">
                                            <Download className="w-3 h-3" /> Download Certificate
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Navigation: After adding policies, proceed */}
                    {isNewFarmer && (
                        <div className="mt-6 flex justify-end gap-4">
                            <button
                                onClick={() => setStep('done')}
                                className="btn-primary px-8 py-4 rounded-xl text-lg font-bold shadow-lg flex items-center gap-3 transform hover:-translate-y-0.5 transition"
                            >
                                {policies.length > 0 ? t('fp.finish') : t('fp.skip_finish')} <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {isExisting && policies.length > 0 && (
                        <div className="mt-6 flex justify-end gap-4">
                            <button onClick={() => navigate('/claim')} className="bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 px-8 py-4 rounded-xl font-bold shadow-lg">
                                <FileText className="w-5 h-5" /> {t('fp.file_claim')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FarmerPolicyPage;
