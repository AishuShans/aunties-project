import React from 'react';
import { useTranslation } from '../i18n/LanguageContext';

const FAQ = () => {
    const { t } = useTranslation();

    return (
        <div className="max-w-3xl mx-auto py-12">
            <h1 className="text-3xl font-bold text-green-800 mb-8 border-b pb-4">{t('faq.title')}</h1>

            <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{t('faq.q1')}</h3>
                    <p className="text-gray-600">
                        {t('faq.a1')}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{t('faq.q2')}</h3>
                    <p className="text-gray-600">
                        {t('faq.a2')}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{t('faq.q3')}</h3>
                    <p className="text-gray-600">
                        {t('faq.a3')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default FAQ;
