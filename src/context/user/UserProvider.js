import {useEffect,useContext,useReducer} from 'react';
import {db,auth} from 'config/db';
import {doc,setDoc,getDoc,updateDoc,serverTimestamp} from 'firebase/firestore';
import {createUserWithEmailAndPassword,updateProfile,signInWithEmailAndPassword,signOut,sendPasswordResetEmail,confirmPasswordReset,onAuthStateChanged} from 'firebase/auth';

import UserContext from './UserContext';
import UserReducer from './UserReducer';
import {
    CHECK_LOGIN,REGISTER,LOGIN,LOGOUT,FORGET_PASSWORD,RESET_PASSWORD,
    CHECK_LOGIN_FAIL,REGISTER_FAIL,LOGIN_FAIL,FORGET_PASSWORD_FAIL,RESET_PASSWORD_FAIL
} from './UserType';

import MessageContext from 'context/message/MessageContext';

const UserProvider=({children})=>{
    const {setRequest,setRequestFinish,setError,setSuccess}=useContext(MessageContext);

    const initialState={
        role: "",
        user: {}
    };
    const [state,dispatch]=useReducer(UserReducer,initialState);
	
    const register=async(username,email,password)=>{
        try{
            setRequest();
            const res=await createUserWithEmailAndPassword(auth,email,password);
            await updateProfile(auth.currentUser,{displayName: username});
            await setDoc(doc(db,"users",res.user.uid),{
                username,
                email,
                role: "user",
                provider: "Email",
                from: "Web",
                createAt: serverTimestamp(),
                updateAt: serverTimestamp(),
                lastLoginAt: serverTimestamp()
            });
            setRequestFinish();
            setSuccess("註冊成功，請重新登入");
            dispatch({
                type: REGISTER
            });
        }
        catch(err){
            setRequestFinish();
            setError("Email已重複");
            dispatch({
                type: REGISTER_FAIL
            });
        }
    };

    const login=async(email,password)=>{
        try{
            setRequest();
            const res=await signInWithEmailAndPassword(auth,email,password);
            await updateDoc(doc(db,"users",res.user.uid),{lastLoginAt: serverTimestamp()});
            const docSnap=await getDoc(doc(db,"users",res.user.uid));
            if(docSnap.exists()){
                setSuccess("登入成功");
                dispatch({
                    type: LOGIN,
                    payload: {
                        user: {
                            id: res.user.uid,
                            ...docSnap.data()
                        }
                    }
                });
            }
            else{
                setError("Email不存在");
                dispatch({
                    type: LOGIN_FAIL
                });
            }
            setRequestFinish();
        }
        catch(err){
            setRequestFinish();
            if(err.code==="auth/user-not-found"){
                setError("Email不存在");
            }
            else if(err.code==="auth/wrong-password"){
                setError("密碼錯誤");
            }
            dispatch({
                type: LOGIN_FAIL
            });
        }
    };

    const logout=async()=>{
        await signOut(auth);
        dispatch({
            type: LOGOUT
        });
    };

    const forgetPassword=async(email)=>{
        try{
            setRequest();
            await sendPasswordResetEmail(auth,email);
            setRequestFinish();
            setSuccess("請前往Email信箱，進行密碼重設");
            dispatch({
                type: FORGET_PASSWORD
            });
        }
        catch(err){
            setRequestFinish();
            setError("Email不存在");
            dispatch({
                type: FORGET_PASSWORD_FAIL
            });
        }
    };

    const resetPassword=async(oobCode,newPassword)=>{
        try{
            setRequest();
            await confirmPasswordReset(auth,oobCode,newPassword);
            setRequestFinish();
            setSuccess("密碼重設成功，請重新登入");
            dispatch({
                type: RESET_PASSWORD
            });
        }
        catch(err){
            setRequestFinish();
            setError("密碼重設失敗");
            dispatch({
                type: RESET_PASSWORD_FAIL
            });
        }
    };

    useEffect(()=>{
		const unsubscribe=onAuthStateChanged(auth,async(user)=>{
            if(user){
                const docSnap=await getDoc(doc(db,"users",user.uid));
                if(docSnap.exists()){
                    dispatch({
                        type: CHECK_LOGIN,
                        payload: {
                            user: {
                                id: user.uid,
                                ...docSnap.data()
                            }
                        } 
                    });
                }
                else{
                    dispatch({
                        type: CHECK_LOGIN_FAIL
                    });
                }
            }
            else{
                dispatch({
                    type: CHECK_LOGIN_FAIL
                });
            }
        });
    
        return ()=>{
            unsubscribe();
        };
	},[]);

    return(
        <UserContext.Provider value={{
            role: state.role,
            user: state.user,
            register,
            login,
            logout,
			forgetPassword,
            resetPassword
        }}>
            {children}
        </UserContext.Provider>
    );
};

export default UserProvider;