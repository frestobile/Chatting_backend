import jwt from 'jsonwebtoken'

export const protect = (req, res, next) => {
  let token

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // ヘッダーのベアラートークンからトークンを設定します
    token = req.headers.authorization.split(' ')[1]
  }

  // トークンが存在することを確認してください
  if (!token) {
    return res.status(401).json({
      success: false,
      data: {
        name: 'このルートにアクセスする権限がありません。',
      },
    })
  }

  try {
    // トークンを検証する
    const jwt_secret = process.env.JWT_SECRET ?? 'secret'
    const decoded = jwt.verify(token, jwt_secret)
    req.user = decoded

    next()
  } catch (err) {
    return res.status(401).json({
      success: false,
      data: {
        name: 'このルートへのアクセスは許可されていません',
      },
    })
  }
}
