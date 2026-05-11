import React, { useState } from 'react';
import api from '../api';
import { useTranslation } from '../i18n/LanguageContext';
import { UserPlus, Download, CheckCircle, ArrowRight, Shield } from 'lucide-react';

const FarmerRegistration = () => {
    const { t, language } = useTranslation();
    const [formData, setFormData] = useState({
        full_name: '',
        mobile_number: '',
        address: '',
        state: '',
        district: '',
        village: ''
    });
    const [loading, setLoading] = useState(false);
    const [successData, setSuccessData] = useState(null);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const response = await api.post('/api/farmers', formData);
            setSuccessData(response.data);
        } catch (err) {
            console.error(err);
            setError("Registration failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const downloadPDF = async () => {
        if (!successData) return;
        try {
            const response = await api.get(`/api/farmers/${successData.farmer_id}/card?lang=${language}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Farmer_Card_${successData.farmer_id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Download failed:", err);
            alert("Could not download the certificate.");
        }
    };

    if (successData) {
        return (
            <div className="max-w-2xl mx-auto py-12 px-4 text-center">
                <div className="glass p-10 rounded-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500 opacity-10 rounded-full blur-3xl"></div>
                    <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-12 h-12 text-emerald-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('registration.success')}</h2>
                    <p className="text-gray-600 mb-8">{t('registration.id_is')} <span className="font-black text-emerald-700 text-2xl">{successData.farmer_id}</span></p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button 
                            onClick={downloadPDF}
                            className="btn-primary flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold"
                        >
                            <Download className="w-5 h-5" />
                            {t('registration.download')}
                        </button>
                        <button 
                            onClick={() => window.location.href = `/policies?farmer_id=${successData.farmer_id}`}
                            className="bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold shadow-lg shadow-blue-100"
                        >
                            <Shield className="w-5 h-5" />
                            {t('registration.link_policy')}
                        </button>
                        <button 
                            onClick={() => setSuccessData(null)}
                            className="bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold"
                        >
                            {t('registration.new_reg')}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center p-3 bg-emerald-100 rounded-full mb-4">
                    <UserPlus className="w-8 h-8 text-emerald-600" />
                </div>
                <h1 className="text-4xl font-extrabold text-gradient mb-2">{t('registration.title')}</h1>
                <p className="text-gray-600">{t('registration.desc')}</p>
            </div>

            {error && <div className="bg-red-100 text-red-700 p-4 rounded-xl mb-6 text-center font-medium border border-red-200">{error}</div>}

            <form onSubmit={handleSubmit} className="glass p-8 rounded-3xl shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-400"></div>
                
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-2">{t('registration.full_name')}</label>
                        <input required type="text" name="full_name" value={formData.full_name} onChange={handleChange} className="w-full rounded-xl input-glass p-4 text-lg" placeholder="e.g. Rajesh Kumar" />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">{t('registration.mobile')}</label>
                        <input required type="text" name="mobile_number" value={formData.mobile_number} onChange={handleChange} className="w-full rounded-xl input-glass p-4" placeholder="10-digit number" />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">{t('registration.village')}</label>
                        <input required type="text" name="village" value={formData.village} onChange={handleChange} className="w-full rounded-xl input-glass p-4" placeholder="Village name" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">{t('registration.district')}</label>
                        <input required type="text" name="district" value={formData.district} onChange={handleChange} className="w-full rounded-xl input-glass p-4" placeholder="District" />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">{t('registration.state')}</label>
                        <input required type="text" name="state" value={formData.state} onChange={handleChange} className="w-full rounded-xl input-glass p-4" placeholder="State" />
                    </div>

                    <div className="col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-2">{t('registration.address')}</label>
                        <textarea required name="address" value={formData.address} onChange={handleChange} className="w-full rounded-xl input-glass p-4 h-32" placeholder="Full postal address..."></textarea>
                    </div>
                </div>

                <div className="mt-10">
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full py-5 rounded-2xl text-xl font-bold shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.01] active:scale-[0.99]"
                    >
                        {loading ? t('common.loading') : (
                            <>
                                <UserPlus className="w-6 h-6" />
                                {t('registration.submit')}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default FarmerRegistration;
