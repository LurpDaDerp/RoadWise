// DriveContext.js
import React, { createContext, useContext, useState } from 'react';

const DriveContext = createContext();

export const DriveProvider = ({ children }) => {
  const [driveJustCompleted, setDriveJustCompleted] = useState(false);

  return (
    <DriveContext.Provider value={{ driveJustCompleted, setDriveJustCompleted }}>
      {children}
    </DriveContext.Provider>
  );
};

export const useDrive = () => useContext(DriveContext);
