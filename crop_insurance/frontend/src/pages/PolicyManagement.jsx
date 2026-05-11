import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import { useTranslation } from '../i18n/LanguageContext';
import { Shield, Plus, List, Search, CheckCircle, AlertCircle } from 'lucide-react';

const PolicyManagement = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const initialFarmerId = queryParams.get('farmer_id') || '';

    const [farmerId, setFarmerId] = useState(initialFarmerId);
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        policy_number: '',
        farmer_id: initialFarmerId,
        crop_type: '',
        insured_amount: '',
        start_date: '',
        end_date: '',
        status: 'Active'
    });
    const [success, setSuccess] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (farmerId) {
            fetchPolicies();
            setFormData(prev => ({ ...prev, farmer_id: farmerId }));
        }
    }, [farmerId]);

    const fetchPolicies = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/api/farmers/${farmerId}/policies`);
            setPolicies(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        try {
            await api.post('/api/policies', {
                ...formData,
                insured_amount: parseFloat(formData.insured_amount)
            });
            setSuccess(t('policies.success'));
            setFormData({
                ...formData,
                policy_number: '',
                crop_type: '',
                insured_amount: '',
                start_date: '',
                end_date: ''
            });
            fetchPolicies();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to link policy.");
        }
    };

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-4">
                    <Shield className="w-8 h-8 text-blue-600" />
                </div>
                <h1 className="text-4xl font-extrabold text-gradient mb-2">{t('policies.title')}</h1>
                <p className="text-gray-600">{t('policies.desc')}</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Search & Form Section */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass p-6 rounded-2xl shadow-lg border border-white/50">
                        <label className="block text-sm font-bold text-gray-700 mb-2">{t('policies.farmer_id_search')}</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={farmerId} 
                                onChange={(e) => setFarmerId(e.target.value.toUpperCase())}
                                className="w-full rounded-xl input-glass pl-10 p-3 font-mono"
                                placeholder="FARM2026..."
                            />
                            <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="glass p-6 rounded-2xl shadow-lg border border-white/50 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-blue-600" />
                            {t('policies.add_policy')}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase">{t('policies.policy_num')}</label>
                                <input required type="text" name="policy_number" value={formData.policy_number} onChange={handleChange} className="w-full rounded-lg border-gray-200 p-2.5 mt-1 focus:ring-blue-500" placeholder="POL-XXXXX" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase">{t('policies.crop')}</label>
                                <select required name="crop_type" value={formData.crop_type} onChange={handleChange} className="w-full rounded-lg border-gray-200 p-2.5 mt-1">
                                    <option value="">Select Crop</option>
                                    <option value="Wheat">Wheat</option>
                                    <option value="Rice">Rice</option>
                                    <option value="Maize">Maize</option>
                                    <option value="Cotton">Cotton</option>
                                    <option value="Sugarcane">Sugarcane</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase">{t('policies.amount')}</label>
                                <input required type="number" name="insured_amount" value={formData.insured_amount} onChange={handleChange} className="w-full rounded-lg border-gray-200 p-2.5 mt-1" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase">{t('policies.start_date')}</label>
                                    <input required type="date" name="start_date" value={formData.start_date} onChange={handleChange} className="w-full rounded-lg border-gray-200 p-2.5 mt-1 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase">{t('policies.end_date')}</label>
                                    <input required type="date" name="end_date" value={formData.end_date} onChange={handleChange} className="w-full rounded-lg border-gray-200 p-2.5 mt-1 text-sm" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase">{t('policies.status')}</label>
                                <select name="status" value={formData.status} onChange={handleChange} className="w-full rounded-lg border-gray-200 p-2.5 mt-1">
                                    <option value="Active">{t('policies.active')}</option>
                                    <option value="Expired">{t('policies.expired')}</option>
                                </select>
                            </div>

                            {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
                            {success && <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}

                            <button type="submit" disabled={!farmerId} className="w-full btn-primary py-3 rounded-xl font-bold mt-4 shadow-lg shadow-blue-100 disabled:opacity-50">
                                {t('policies.submit')}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Policies List Section */}
                <div className="lg:col-span-2">
                    <div className="glass p-8 rounded-3xl shadow-xl min-h-[400px]">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 border-b pb-4">
                            <List className="w-6 h-6 text-emerald-600" />
                            {t('policies.current_policies')}
                        </h2>

                        {!farmerId ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                <Search className="w-12 h-12 mb-4 opacity-20" />
                                <p>{t('policies.farmer_id_search')}</p>
                            </div>
                        ) : loading ? (
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
                                        <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-black uppercase rounded-bl-xl ${policy.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            {policy.status}
                                        </div>
                                        <p className="text-xs text-gray-400 font-mono mb-1">{policy.policy_number}</p>
                                        <h3 className="text-lg font-bold text-gray-800 mb-3">{policy.crop_type}</h3>
                                        
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Insured Amount</p>
                                                <p className="text-xl font-black text-blue-700">₹ {policy.insured_amount.toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-gray-50 grid grid-cols-2 text-[10px] text-gray-500 font-bold uppercase">
                                            <div>Starts: <span className="text-gray-900">{policy.start_date}</span></div>
                                            <div className="text-right">Ends: <span className="text-gray-900">{policy.end_date}</span></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PolicyManagement;
