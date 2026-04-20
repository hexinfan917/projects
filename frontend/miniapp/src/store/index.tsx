import React, { createContext, useContext, useState } from 'react'

const StoreContext = createContext<any>({})

export function Provider({ children }) {
  const [userInfo, setUserInfo] = useState<any>(null)

  return (
    <StoreContext.Provider value={{ userInfo, setUserInfo }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  return useContext(StoreContext)
}
