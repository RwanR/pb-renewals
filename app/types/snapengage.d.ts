declare global {
  interface Window {
    SnapEngage?: {
      showButton: () => void;
      hideButton: () => void;
      startLink: () => void;
      setUserEmail: (email: string, showForm?: boolean) => void;
      setUserName: (name: string) => void;
      setCustomField: (name: string, value: string) => void;
      setLocale: (locale: string) => void;
    };
  }
}
export {};