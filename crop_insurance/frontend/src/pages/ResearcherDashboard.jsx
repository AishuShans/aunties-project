import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { useTranslation } from '../i18n/LanguageContext';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#0ea5e9'];

const ResearcherDashboard = () => {
    const { t, language } = useTranslation();
    const [allClaims, setAllClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCard, setActiveCard] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedRow, setExpandedRow] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchClaims = async () => {
            try {
                const response = await api.get('/api/admin/claims');
                setAllClaims(response.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchClaims();
    }, []);

    const getTranslatedStatus = (status) => {
        const key = status.toLowerCase();
        return t(`status.states.${key}`);
    };

    if (loading) return (
        <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-600"></div>
        </div>
    );
    
    if (!allClaims) return <div className="text-center py-20 text-xl font-bold text-red-600 border border-red-200 bg-red-50 rounded-xl m-8">{t('common.error_loading')}</div>;

    // Helper to calculate stats
    const calcStats = (data) => {
        const status_distribution = {};
        const crop_distribution = {};
        data.forEach(c => {
            status_distribution[c.status] = (status_distribution[c.status] || 0) + 1;
            crop_distribution[c.crop_type] = (crop_distribution[c.crop_type] || 0) + 1;
        });
        return {
            total_claims: data.length,
            status_distribution,
            crop_distribution
        };
    };

    const globalStats = calcStats(Array.isArray(allClaims) ? allClaims : []);

    // Filter claims based on active card and search
    const displayedClaims = (Array.isArray(allClaims) ? allClaims : []).filter(c => {
        if (activeCard !== 'All' && c.status !== activeCard) return false;
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            return (
                c.farmer_name.toLowerCase().includes(searchLower) ||
                c.claim_id.toLowerCase().includes(searchLower) ||
                c.village.toLowerCase().includes(searchLower) ||
                c.crop_type.toLowerCase().includes(searchLower)
            );
        }
        return true;
    });

    const chartStats = calcStats(displayedClaims);

    // Transform data for Recharts based on FILTERED data
    const statusData = Object.keys(chartStats.status_distribution).map((key, index) => ({
        name: getTranslatedStatus(key),
        value: chartStats.status_distribution[key],
        color: COLORS[index % COLORS.length]
    }));

    const cropData = Object.keys(chartStats.crop_distribution).map(key => ({
        name: key,
        claims: chartStats.crop_distribution[key]
    })).sort((a,b) => b.claims - a.claims);

    const damageData = displayedClaims.filter(c => c.damage_percentage).map(c => ({
        name: c.claim_id.slice(-4),
        damage: c.damage_percentage
    })).slice(0, 10);

    // Mock Historical Payouts
    const historicalPayouts = [
        { month: 'Jan', amount: 450000 },
        { month: 'Feb', amount: 520000 },
        { month: 'Mar', amount: 380000 },
        { month: 'Apr', amount: 610000 },
        { month: 'May', amount: 750000 },
        { month: 'Jun', amount: 820000 },
    ];

    const formatCurrency = (val) => {
        if (val === null || val === undefined) return '₹ 0';
        return `₹ ${Number(val).toLocaleString(language === 'ta' ? 'en-IN' : 'en-IN')}`;
    };

    const handleExportCSV = async () => {
        try {
            const response = await api.get('/api/admin/claims/export', {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'claims_export.csv');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (error) {
            console.error("Error exporting CSV", error);
            alert("Failed to export data.");
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            'Approved': 'bg-green-100 text-green-800 border-green-200',
            'Rejected': 'bg-red-100 text-red-800 border-red-200',
            'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        };
        return <span className={`px-3 py-1 rounded-full text-xs font-bold border ${styles[status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>{getTranslatedStatus(status)}</span>;
    };

    return (
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center">
                <span className="text-emerald-600 font-bold tracking-widest uppercase text-sm border-b-2 border-emerald-500 pb-1">{t('research.analytics_portal')}</span>
                <h1 className="text-4xl font-extrabold mt-4 text-gray-900 tracking-tight">{t('research.title')}</h1>
                <p className="mt-2 text-gray-500">{t('research.subtitle')}</p>
            </div>

            {/* Interactive KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div 
                    onClick={() => setActiveCard('All')} 
                    className={`glass p-6 rounded-2xl shadow-xl flex flex-col justify-between border-t-4 border-blue-500 cursor-pointer transition-all duration-300 transform hover:scale-[1.05] hover:shadow-blue-500/30 ${activeCard === 'All' ? 'ring-4 ring-blue-500/50 scale-[1.02] bg-blue-50/50' : ''}`}
                >
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">{t('research.kpis.total')}</p>
                        <p className="text-4xl font-black text-gray-900 mt-2">{globalStats.total_claims}</p>
                    </div>
                    <div className="mt-4"><p className="text-xs text-blue-600 font-semibold italic opacity-80">{t('research.kpis.click_all')}</p></div>
                </div>
                
                <div 
                    onClick={() => setActiveCard('Approved')} 
                    className={`glass p-6 rounded-2xl shadow-xl flex flex-col justify-between border-t-4 border-emerald-500 cursor-pointer transition-all duration-300 transform hover:scale-[1.05] hover:shadow-emerald-500/30 ${activeCard === 'Approved' ? 'ring-4 ring-emerald-500/50 scale-[1.02] bg-emerald-50/50' : ''}`}
                >
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">{t('research.kpis.approved')}</p>
                        <p className="text-4xl font-black text-emerald-600 mt-2">{globalStats.status_distribution['Approved'] || 0}</p>
                    </div>
                    <div className="mt-4"><p className="text-xs text-emerald-600 font-semibold italic opacity-80">{t('research.kpis.click_drill')}</p></div>
                </div>
                
                <div 
                    onClick={() => setActiveCard('Rejected')} 
                    className={`glass p-6 rounded-2xl shadow-xl flex flex-col justify-between border-t-4 border-red-500 cursor-pointer transition-all duration-300 transform hover:scale-[1.05] hover:shadow-red-500/30 ${activeCard === 'Rejected' ? 'ring-4 ring-red-500/50 scale-[1.02] bg-red-50/50' : ''}`}
                >
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">{t('research.kpis.rejected')}</p>
                        <p className="text-4xl font-black text-red-600 mt-2">{globalStats.status_distribution['Rejected'] || 0}</p>
                    </div>
                    <div className="mt-4"><p className="text-xs text-red-600 font-semibold italic opacity-80">{t('research.kpis.click_drill')}</p></div>
                </div>

                <div 
                    onClick={() => setActiveCard('Pending')} 
                    className={`glass p-6 rounded-2xl shadow-xl flex flex-col justify-between border-t-4 border-yellow-500 cursor-pointer transition-all duration-300 transform hover:scale-[1.05] hover:shadow-yellow-500/30 ${activeCard === 'Pending' ? 'ring-4 ring-yellow-500/50 scale-[1.02] bg-yellow-50/50' : ''}`}
                >
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">{t('research.kpis.pending')}</p>
                        <p className="text-4xl font-black text-yellow-600 mt-2">{globalStats.status_distribution['Pending'] || 0}</p>
                    </div>
                    <div className="mt-4"><p className="text-xs text-yellow-600 font-semibold italic opacity-80">{t('research.kpis.click_drill')}</p></div>
                </div>
            </div>

            {/* Drill-Down Data Table */}
            <div className="glass rounded-3xl p-6 mb-12 shadow-xl border border-white/60">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b border-gray-200 pb-4">
                    <h2 className="text-2xl font-bold text-gray-800">
                        {activeCard === 'All' ? t('research.table.all_db') : `${getTranslatedStatus(activeCard)} ${t('research.table.dir')}`}
                        <span className="ml-3 bg-gray-100 text-gray-600 text-sm py-1 px-3 rounded-full">{displayedClaims.length} {t('research.table.records')}</span>
                    </h2>
                    <div className="w-full md:w-96 relative">
                        <input 
                            type="text" 
                            placeholder={t('research.table.search_placeholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white/50 backdrop-blur-sm transition-all"
                        />
                        <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white/40">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                                <th className="p-4 font-bold">{t('research.table.id')}</th>
                                <th className="p-4 font-bold">{t('research.table.name')}</th>
                                <th className="p-4 font-bold">{t('research.table.village')}</th>
                                <th className="p-4 font-bold">{t('research.table.crop_event')}</th>
                                <th className="p-4 font-bold text-right">{t('research.table.amount')}</th>
                                <th className="p-4 font-bold text-center">{t('research.table.ai_score')}</th>
                                <th className="p-4 font-bold text-center">{t('research.table.status')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {displayedClaims.length === 0 ? (
                                <tr><td colSpan="7" className="p-8 text-center text-gray-500 font-medium">{t('research.table.no_match')}</td></tr>
                            ) : displayedClaims.map(claim => (
                                <React.Fragment key={claim.id}>
                                    <tr 
                                        onClick={() => setExpandedRow(expandedRow === claim.id ? null : claim.id)}
                                        className="hover:bg-emerald-50/50 cursor-pointer transition-colors group"
                                    >
                                        <td className="p-4 font-mono text-sm font-bold text-emerald-700">{claim.claim_id}</td>
                                        <td className="p-4 font-semibold text-gray-800">
                                            {claim.farmer_name}
                                            <div className="text-xs text-gray-500 font-normal">ID: {claim.farmer_id}</div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-600">{claim.village}</td>
                                        <td className="p-4">
                                            <div className="text-sm font-bold text-gray-700">{claim.crop_type}</div>
                                            <div className="text-xs text-gray-500 font-medium">{claim.policy_number}</div>
                                        </td>
                                        <td className="p-4 text-right font-bold text-gray-800">{formatCurrency(claim?.requested_claim_amount)}</td>
                                        <td className="p-4 text-center">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-100">
                                                {claim.ml_confidence ? (claim.ml_confidence * 100).toFixed(1) : '0.0'}%
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">{getStatusBadge(claim.status)}</td>
                                    </tr>
                                    {/* Expanded Row Content */}
                                    {expandedRow === claim.id && (
                                        <tr className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b-2 border-emerald-200">
                                            <td colSpan="7" className="p-6">
                                                <div className="flex flex-col md:flex-row justify-between gap-6">
                                                    <div className="flex-1">
                                                        <h4 className="font-bold text-emerald-800 mb-2 border-b border-emerald-200 pb-1 flex items-center gap-2">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                            {t('research.insights.title')}
                                                        </h4>
                                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                                            <div><span className="text-gray-500">{t('research.insights.damage')}:</span> <span className="font-bold text-red-600">{claim.damage_percentage ? claim.damage_percentage.toFixed(2) : '0.00'}%</span></div>
                                                            <div><span className="text-gray-500">{t('research.insights.risk')}:</span> <span className="font-bold text-gray-800">{claim.fraud_risk_level}</span></div>
                                                            <div><span className="text-gray-500">{t('research.insights.area')}:</span> <span className="font-bold text-gray-800">{claim.area_acres} {t('research.insights.acres')}</span></div>
                                                            <div><span className="text-gray-500">{t('research.insights.sown')}:</span> <span className="font-bold text-gray-800">{claim.sowing_date}</span></div>
                                                        </div>
                                                        {claim.admin_notes && (
                                                            <div className="mt-3 p-3 bg-white/60 rounded border border-gray-200 text-sm">
                                                                <span className="font-bold text-gray-700">{t('research.insights.note')}:</span> {claim.admin_notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col justify-center gap-3 border-l border-emerald-200 pl-6">
                                                        <button onClick={(e) => { e.stopPropagation(); navigate('/status', { state: { claimId: claim.claim_id } }); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow transition-colors">
                                                            {t('research.insights.profile')}
                                                        </button>
                                                        {['Approved', 'Rejected'].includes(claim.status) && (
                                                            <a href={`/api/claims/${claim.claim_id}/pdf?lang=${language}`} download onClick={(e) => e.stopPropagation()} className="text-center bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-bold shadow transition-colors">
                                                                {t('research.insights.download')}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Dynamic Visuals below the table */}
            <div className="grid lg:grid-cols-3 gap-8 mb-8">
                {/* Status Distribution */}
                <div className="glass p-6 rounded-2xl border border-white/50 shadow-xl lg:col-span-1 transition-all duration-500">
                    <h2 className="text-lg font-bold mb-6 text-gray-800">{t('research.charts.status')}</h2>
                    <div className="h-64">
                        {displayedClaims.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-gray-400 font-medium">{t('research.charts.no_data')}</div>
                        )}
                    </div>
                </div>

                {/* Historical Payouts Line Chart */}
                <div className="glass p-6 rounded-2xl border border-white/50 shadow-xl lg:col-span-2">
                    <h2 className="text-lg font-bold mb-6 text-gray-800">{t('research.charts.payouts')}</h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={historicalPayouts} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="month" stroke="#6b7280" axisLine={false} tickLine={false} />
                                <YAxis stroke="#6b7280" tickFormatter={(val) => `₹${val/1000}k`} axisLine={false} tickLine={false} />
                                <RechartsTooltip 
                                    formatter={(value) => formatCurrency(value)}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={4} dot={{ r: 5, strokeWidth: 2 }} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 mb-12">
                {/* Crop Type Bar Chart */}
                <div className="glass p-6 rounded-2xl border border-white/50 shadow-xl transition-all duration-500">
                    <h2 className="text-lg font-bold mb-6 text-gray-800">{t('research.charts.crops')}</h2>
                    <div className="h-72">
                        {cropData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={cropData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="name" stroke="#6b7280" axisLine={false} tickLine={false} />
                                    <YAxis stroke="#6b7280" axisLine={false} tickLine={false} />
                                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} cursor={{fill: '#f3f4f6'}} />
                                    <Bar dataKey="claims" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-gray-400 font-medium">{t('research.charts.no_data')}</div>
                        )}
                    </div>
                </div>

                {/* Damage Distribution Chart */}
                <div className="glass p-6 rounded-2xl border border-white/50 shadow-xl transition-all duration-500">
                    <h2 className="text-lg font-bold mb-6 text-gray-800">Damage % Distribution</h2>
                    <div className="h-72">
                        {damageData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={damageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="name" stroke="#6b7280" axisLine={false} tickLine={false} />
                                    <YAxis stroke="#6b7280" axisLine={false} tickLine={false} />
                                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} cursor={{fill: '#f3f4f6'}} />
                                    <Bar dataKey="damage" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-gray-400 font-medium">{t('research.charts.no_data')}</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Export Section */}
            <div className="glass border border-emerald-200 p-8 rounded-3xl flex flex-col sm:flex-row justify-between items-center text-center sm:text-left gap-6 shadow-2xl mt-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 opacity-10 blur-3xl rounded-full pointer-events-none"></div>
                <div className="z-10">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('research.export.title')}</h2>
                    <p className="text-gray-600 max-w-2xl text-sm leading-relaxed">
                        {t('research.export.desc')}
                    </p>
                </div>
                <button onClick={handleExportCSV} className="z-10 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-black hover:to-gray-900 text-white px-8 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 whitespace-nowrap shadow-lg hover:shadow-2xl transform hover:-translate-y-1">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    {t('research.export.btn')}
                </button>
            </div>
        </div>
    );
};

export default ResearcherDashboard;
