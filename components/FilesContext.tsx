'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface FilesContextType {
    fileList: any;
    loading: boolean;
    error: string | null;
}

const FilesContext = createContext<FilesContextType | undefined>(undefined);

export function FilesProvider({ children }: { children: ReactNode }) {
    const [fileList, setFileList] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const baseUrl = process.env.NEXT_PUBLIC_FILES_BASE_URL || 'https://clevertree.github.io/paradigm-threat-files';
        let isMounted = true;

        const fetchFiles = async () => {
            try {
                const response = await fetch(`${baseUrl}/index.json`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch index: ${response.status}`);
                }
                const data = await response.json();
                if (isMounted) {
                    setFileList(data);
                    setLoading(false);
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err.message);
                    setLoading(false);
                }
            }
        };

        fetchFiles();

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <FilesContext.Provider value={{ fileList, loading, error }}>
            {children}
        </FilesContext.Provider>
    );
}

export function useFiles() {
    const context = useContext(FilesContext);
    if (context === undefined) {
        throw new Error('useFiles must be used within a FilesProvider');
    }
    return context;
}
