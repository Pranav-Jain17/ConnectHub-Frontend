
export const getLoginToken = () => {
    return localStorage.getItem('loginToken') || sessionStorage.getItem('loginToken');
};
