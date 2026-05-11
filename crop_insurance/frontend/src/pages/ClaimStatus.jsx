import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import { useTranslation } from '../i18n/LanguageContext';

const ClaimStatus = () => {
    const location = useLocation();
    const { t, language } = useTranslation();
    const [searchId, setSearchId] = useState('');
    const [claim, setClaim] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (location.state && location.state.claimId) {
            setSearchId(location.state.claimId);
            handleSearch(location.state.claimId);
        }
    }, [location]);

    const handleSearch = async (idToSearch) => {
        if (!idToSearch) return;
        setLoading(true);
        setError(null);
        setClaim(null);
        try {
            const response = await api.get(`/api/claims/${idToSearch}`);
            setClaim(response.data);
        } catch (err) {
            console.error(err);
            setError(t('status.not_found'));
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Pending': return 'bg-yellow-100 text-yellow-800';
            case 'Verified': return 'bg-blue-100 text-blue-800';
            case 'Approved': return 'bg-green-100 text-green-800';
            case 'Rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getTranslatedStatus = (status) => {
        const key = status.toLowerCase();
        return t(`status.states.${key}`);
    };

    const handleDownloadProvisional = async () => {
        try {
            const response = await api.get(`/api/claims/${claim.claim_id}/pdf?lang=${language}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `${claim.status === 'Pending' ? 'Provisional_Notice_' : 'Official_Settlement_'}${claim.claim_id}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error(err);
            alert("Failed to download PDF.");
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-12">
            <h1 className="text-3xl font-bold mb-8 text-green-800 text-center">{t('status.title')}</h1>

            <div className="bg-white p-6 shadow-md rounded-lg mb-8 max-w-2xl mx-auto">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSearch(searchId); }}
                    className="flex gap-4"
                >
                    <input
                        type="text"
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                        placeholder={t('status.enter_id')}
                        className="flex-grow p-3 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:outline-none"
                    />
                    <button type="submit" className="bg-green-600 text-white px-6 py-3 rounded font-bold hover:bg-green-700 transition">
                        {loading ? t('status.searching') : t('status.search')}
                    </button>
                </form>
                {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
            </div>

            {claim && (
                <div className="glass p-8 shadow-xl rounded-2xl border-t-4 border-green-500 bg-white/80 backdrop-blur-md">
                    <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
                        <div>
                            <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">{t('status.id')}</p>
                            <h2 className="text-3xl font-black text-gray-800 tracking-tight">{claim.claim_id}</h2>
                        </div>
                        <div className={`px-4 py-2 rounded-xl text-sm font-bold shadow-sm ${getStatusColor(claim.status)}`}>
                            {getTranslatedStatus(claim.status)}
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 mb-8">
                        <div className="bg-white/50 p-5 rounded-xl border border-gray-100 shadow-sm">
                            <h3 className="font-bold text-green-800 border-b border-green-100 pb-2 mb-4">{t('status.farmer_details')}</h3>
                            <p className="mb-2"><span className="text-gray-500 font-medium w-24 inline-block">{t('status.name')}:</span> <span className="font-bold text-gray-800">{claim.farmer_name}</span></p>
                            <p className="mb-2"><span className="text-gray-500 font-medium w-24 inline-block">{t('status.village')}:</span> <span className="font-semibold text-gray-700">{claim.village}</span></p>
                            <p><span className="text-gray-500 font-medium w-24 inline-block">{t('status.phone')}:</span> <span className="font-semibold text-gray-700">{claim.phone_number}</span></p>
                        </div>
                        <div className="bg-white/50 p-5 rounded-xl border border-gray-100 shadow-sm">
                            <h3 className="font-bold text-green-800 border-b border-green-100 pb-2 mb-4">{t('status.event_details')}</h3>
                            <p className="mb-2"><span className="text-gray-500 font-medium w-24 inline-block">{t('status.crop')}:</span> <span className="font-bold text-gray-800">{claim.crop_type}</span></p>
                            <p className="mb-2"><span className="text-gray-500 font-medium w-24 inline-block">Policy:</span> <span className="font-semibold text-blue-600">{claim.policy_number}</span></p>
                            <p><span className="text-gray-500 font-medium w-24 inline-block">{t('status.date')}:</span> <span className="font-semibold text-gray-700">{claim.event_start_date}</span></p>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-xl mb-6 border border-gray-200 shadow-inner">
                        <h3 className="font-bold text-gray-800 mb-4">{t('status.ai_results')}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 border border-red-100 rounded-xl shadow-sm text-center">
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">{t('status.est_damage')}</p>
                                <p className="text-2xl font-black text-red-600 mt-1">{claim.damage_percentage?.toFixed(1) || 0}%</p>
                            </div>
                            <div className="bg-white p-4 border border-blue-100 rounded-xl shadow-sm text-center">
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">{t('status.ai_confidence')}</p>
                                <p className="text-2xl font-black text-blue-600 mt-1">{claim.ml_confidence ? (claim.ml_confidence * 100).toFixed(1) : 'N/A'}%</p>
                            </div>
                            <div className="bg-white p-4 border border-emerald-100 rounded-xl shadow-sm text-center md:col-span-2">
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">{t('status.compensation')}</p>
                                <p className="text-2xl font-black text-emerald-600 mt-1">₹ {claim.suggested_payout?.toLocaleString('en-IN') || '0'}</p>
                            </div>
                        </div>
                        {claim.admin_notes && (
                            <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-sm mt-4">
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">{t('status.admin_note')}</p>
                                <p className="text-gray-800">{claim.admin_notes}</p>
                            </div>
                        )}
                    </div>

                    {claim.status === 'Pending' && (
                        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-6 rounded-xl border border-yellow-200 mb-6 mt-4 shadow-sm">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                <div>
                                    <h3 className="font-bold text-yellow-800 mb-2 flex items-center gap-2">
                                        <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        {t('status.under_review')}
                                    </h3>
                                    <p className="text-sm font-medium text-yellow-700">
                                        {t('status.timeline')}
                                    </p>
                                </div>
                                <button
                                    onClick={handleDownloadProvisional}
                                    className="bg-yellow-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-yellow-700 shadow-md transition whitespace-nowrap transform hover:-translate-y-0.5"
                                >
                                    {t('status.download_provisional')}
                                </button>
                            </div>
                        </div>
                    )}

                    {['Approved', 'Rejected'].includes(claim.status) && (
                        <div className="text-center mt-8">
                            <button
                                onClick={handleDownloadProvisional}
                                className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-4 rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition transform hover:-translate-y-1"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                {t('status.download_official')}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ClaimStatus;
