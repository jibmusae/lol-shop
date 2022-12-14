import { userModel } from '../db';

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

class UserService {
  // 본 파일의 맨 아래에서, new UserService(userModel) 하면, 이 함수의 인자로 전달됨
  constructor(userModel) {
    this.userModel = userModel;
  }

  // 회원가입
  async addUser(userInfo) {
    // 객체 destructuring
    const { email, fullName, password } = userInfo;

    // 이메일 중복 확인
    const user = await this.userModel.findByEmail(email);
    if (user) {
      throw new Error(
        '이 이메일은 현재 사용중입니다. 다른 이메일을 입력해 주세요.',
      );
    }
    // 이메일 중복은 이제 아니므로, 회원가입을 진행함

    // 우선 비밀번호 해쉬화(암호화)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 랜덤 프로필 사진을 지정한다.
    let newProfile = Math.ceil(Math.random() * 407);
    const profileImg = `profileImg\\${newProfile}.jpg`;

    const newUserInfo = {
      fullName,
      email,
      password: hashedPassword,
      profileImg,
    };

    // db에 저장
    const createdNewUser = await this.userModel.create(newUserInfo);

    return createdNewUser;
  }

  async addKakaoUser(userInfo) {
    // 객체 destructuring
    const { fullName, email, loginTypeCode } = userInfo;

    // email 중복 확인
    const user = await this.userModel.findByEmail(email);
    // email 이 없으면 회원 가입을 한다.
    if (!user) {
      // db에 저장
      const createdNewUser = await this.userModel.create(userInfo);
      // 토큰 생성
      const secretKey = process.env.JWT_SECRET_KEY || 'secret-key';
      const token = jwt.sign(
        { userId: createdNewUser._id, isAdmin: createdNewUser.isAdmin },
        secretKey,
      );

      // 기타 필요한 정보들 반환
      const userId = createdNewUser._id;
      const isAdmin = createdNewUser.isAdmin;
      let newProfile = Math.ceil(Math.random() * 407);
      const profileImg = `profileImg\\${newProfile}.jpg`;
      return { token, isAdmin, userId, profileImg, fullName };
    }
    // email이 존재하면 db의 정보를 통해 토큰 생성
    const secretKey = process.env.JWT_SECRET_KEY || 'secret-key';
    const token = jwt.sign(
      { userId: user._id, isAdmin: user.isAdmin },
      secretKey,
    );
    // Admin인지 아닌지 반환
    const userId = user._id;
    const isAdmin = user.isAdmin;
    const profileImg = user.profileImg;
    return { token, isAdmin, userId, profileImg, fullName };
  }

  // 로그인
  async getUserToken(loginInfo) {
    // 객체 destructuring
    const { email, password } = loginInfo;

    // 우선 해당 이메일의 사용자 정보가  db에 존재하는지 확인
    const user = await this.userModel.findByEmail(email);
    if (!user) {
      throw new Error(
        '해당 이메일은 가입 내역이 없습니다. 다시 한 번 확인해 주세요.',
      );
    }

    // 이제 이메일은 문제 없는 경우이므로, 비밀번호를 확인함
    // 비밀번호 일치 여부 확인
    const correctPasswordHash = user.password; // db에 저장되어 있는 암호화된 비밀번호

    // 매개변수의 순서 중요 (1번째는 프론트가 보내온 비밀번호, 2번쨰는 db에 있떤 암호화된 비밀번호)
    const isPasswordCorrect = await bcrypt.compare(
      password,
      correctPasswordHash,
    );

    if (!isPasswordCorrect) {
      throw new Error(
        '비밀번호가 일치하지 않습니다. 다시 한 번 확인해 주세요.',
      );
    }
    // 로그인 성공 -> JWT 웹 토큰 생성
    const secretKey = process.env.JWT_SECRET_KEY || 'secret-key';

    // 2개 프로퍼티를 jwt 토큰에 담음
    const userId = user._id;
    const isAdmin = user.isAdmin;
    const profileImg = user.profileImg;
    const fullName = user.fullName;
    const token = jwt.sign(
      { userId: user._id, isAdmin: user.isAdmin },
      secretKey,
    );

    return { token, isAdmin, userId, profileImg, fullName };
  }
  // Email로 유저 찾기 기능
  async getUserByEmail(email) {
    const user = await this.userModel.findByEmail(email);
    return user;
  }

  // Id로 유저 찾기 기능
  async getUserById(userId) {
    const user = await this.userModel.findById(userId);
    return user;
  }

  // 사용자 목록을 받음.
  async getUsers() {
    const users = await this.userModel.findAll();
    return users;
  }

  // 유저정보 수정
  async setUser(userInfoRequired, toUpdate) {
    // 객체 destructuring
    const { userId } = userInfoRequired;

    // 우선 해당 id의 유저가 db에 있는지 확인
    let user = await this.userModel.findById(userId);

    // db에서 찾지 못한 경우, 에러 메시지 반환
    if (!user) {
      throw new Error('가입 내역이 없습니다. 다시 한 번 확인해 주세요.');
    }
    // 업데이트 시작

    // 비밀번호도 변경하는 경우에는, 회원가입 때처럼 해쉬화 해주어야 함.
    const { password } = toUpdate;

    if (password) {
      const newPasswordHash = await bcrypt.hash(password, 10);
      toUpdate.password = newPasswordHash;
    }

    // 업데이트 진행
    user = await this.userModel.update({
      userId,
      update: toUpdate,
    });

    return user;
  }

  // 유저 삭제
  async deleteUser(userId, password) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('가입 내역이 없습니다. 다시 한 번 확인해 주세요.');
    }

    const passwordHash = user.password;
    const isPasswordCorrect = await bcrypt.compare(password, passwordHash);

    if (!isPasswordCorrect) {
      throw new Error(
        '현재 비밀번호가 일치하지 않습니다. 카카오 로그인 유저는 회원정보 변경에서 비밀번호를 설정해주세요.',
      );
    }

    await this.userModel.delete(userId);
  }
  // 관리자 유저 삭제 기능
  async deleteAdminUser(userId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('가입 내역이 없습니다. 다시 한 번 확인해 주세요.');
    }

    await this.userModel.delete(userId);
  }
}

const userService = new UserService(userModel);

export { userService };
