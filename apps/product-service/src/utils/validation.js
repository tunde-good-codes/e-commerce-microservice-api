const Joi = require("joi");

const validateUserRegistration = (data)=>{
    const schema = Joi.object({
        username: Joi.string().min(5).max(50).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(5).max(60).required(),
    })

    return schema.validate(data);
}



const validateLogin = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  });

  return schema.validate(data);
};
module.exports = { validateUserRegistration, validateLogin };

