import React from "react";
import Form from 'next/form';



const MainPage = () =>{
    
    return (
        <div>
            <Form action="/search">
                <input name="query" type="text" placeholder="Launch your Dreams"></input>
                <button type="submit">Search</button>
            </Form>
        </div>
    )
}

export default MainPage;
