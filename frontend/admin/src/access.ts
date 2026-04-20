export default (initialState: any) => {
  const isLogin = !!initialState?.isLogin;
  return {
    isLogin,
    canAdmin: isLogin && initialState?.role === 'admin',
  };
};
