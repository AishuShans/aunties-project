import React from 'react';
import { Link } from 'react-router-dom';
import { Leaf, ShieldCheck, MapPin, Activity, CheckCircle, Database } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

const Home = () => {
    const { t } = useTranslation();

    return (
        <div className="max-w-6xl mx-auto py-12 px-4 relative">
            <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
            <div className="absolute top-20 right-10 w-72 h-72 bg-teal-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

            <div className="text-center mb-16 relative z-10">
                <div className="inline-flex items-center justify-center p-3 bg-emerald-100 rounded-full mb-6">
                    <Leaf className="w-8 h-8 text-emerald-600 mr-2" />
                    <span className="text-emerald-800 font-bold tracking-wider uppercase text-sm">{t('home.badge')}</span>
                </div>
                <h1 className="text-5xl md:text-6xl font-extrabold mb-6 tracking-tight text-gray-900">
                    {t('home.title').split(' ').slice(0, -2).join(' ')} <span className="text-gradient">{t('home.title').split(' ').slice(-2).join(' ')}</span>
                </h1>
                <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto font-light leading-relaxed">
                    {t('home.subtitle')}
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-16 relative z-10">
                <div className="glass p-8 rounded-3xl group hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100 rounded-bl-full -mr-16 -mt-16 opacity-50"></div>
                    <Leaf className="w-12 h-12 text-emerald-500 mb-6" />
                    <h2 className="text-3xl font-bold mb-4 text-gray-800">{t('home.for_farmers')}</h2>
                    <p className="text-gray-600 mb-8 text-lg">
                        {t('home.for_farmers_desc')}
                    </p>
                    <div className="flex gap-3">
                        <Link to="/farmer-policy" className="btn-primary inline-flex items-center px-6 py-3 rounded-xl font-semibold text-base">
                            {t('home.for_farmers')}
                        </Link>
                        <Link to="/claim" className="bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 inline-flex items-center px-6 py-3 rounded-xl font-semibold text-base transition">
                            {t('home.submit_btn')}
                        </Link>
                    </div>
                </div>

                <div className="glass p-8 rounded-3xl group hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-teal-100 rounded-bl-full -mr-16 -mt-16 opacity-50"></div>
                    <ShieldCheck className="w-12 h-12 text-teal-500 mb-6" />
                    <h2 className="text-3xl font-bold mb-4 text-gray-800">{t('home.for_admins')}</h2>
                    <p className="text-gray-600 mb-8 text-lg">
                        {t('home.for_admins_desc')}
                    </p>
                    <Link to="/admin" className="btn-primary inline-flex items-center px-8 py-3 rounded-xl font-semibold text-lg">
                        {t('home.access_portal')}
                    </Link>
                </div>
            </div>

            <div className="glass-dark p-10 md:p-14 rounded-[40px] text-center relative overflow-hidden">
                <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-emerald-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20"></div>
                <h3 className="text-3xl font-bold mb-10 text-white">{t('home.how_it_works')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm relative z-10">
                    <div className="p-6 bg-gray-800/50 backdrop-blur-md rounded-2xl border border-gray-700/50 transform hover:scale-105 transition-transform">
                        <MapPin className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
                        <div className="font-bold text-gray-200 text-lg">{t('home.steps.step1_title')}</div>
                        <p className="text-gray-400 mt-2">{t('home.steps.step1_desc')}</p>
                    </div>
                    <div className="p-6 bg-gray-800/50 backdrop-blur-md rounded-2xl border border-gray-700/50 transform hover:scale-105 transition-transform">
                        <Database className="w-10 h-10 text-teal-400 mx-auto mb-4" />
                        <div className="font-bold text-gray-200 text-lg">{t('home.steps.step2_title')}</div>
                        <p className="text-gray-400 mt-2">{t('home.steps.step2_desc')}</p>
                    </div>
                    <div className="p-6 bg-gray-800/50 backdrop-blur-md rounded-2xl border border-gray-700/50 transform hover:scale-105 transition-transform">
                        <Activity className="w-10 h-10 text-green-400 mx-auto mb-4" />
                        <div className="font-bold text-gray-200 text-lg">{t('home.steps.step3_title')}</div>
                        <p className="text-gray-400 mt-2">{t('home.steps.step3_desc')}</p>
                    </div>
                    <div className="p-6 bg-gray-800/50 backdrop-blur-md rounded-2xl border border-gray-700/50 transform hover:scale-105 transition-transform">
                        <CheckCircle className="w-10 h-10 text-emerald-300 mx-auto mb-4" />
                        <div className="font-bold text-gray-200 text-lg">{t('home.steps.step4_title')}</div>
                        <p className="text-gray-400 mt-2">{t('home.steps.step4_desc')}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};


export default Home;
